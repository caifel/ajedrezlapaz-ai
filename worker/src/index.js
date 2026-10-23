const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
};

const CONVOCATORIA_PREFIX = 'convocatorias/';
const QR_PREFIX = 'qr/';

const QR_CONTENT_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

const CERTIFICATE_PREFIXES = ['cc-2026', 'adalp/cc-2026'];
const CERTIFICATE_SUFFIXES = [
    '-CC-2026.png',
    'CC-2026.png',
    '_CC-2026.png',
    ' CC-2026.png',
];

function corsHeaders(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin) return {};

    const allowed = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    if (!allowed.includes(origin)) return {};

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
}

function reply(body, status, cors) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...JSON_HEADERS, ...cors },
    });
}

function sameString(a, b) {
    if (a.length !== b.length) return false;

    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

function parseCredentials(body) {
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const fecha = typeof body?.fecha === 'string' ? body.fecha.trim() : '';

    if (!/^ADALP-\d{4}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return null;
    }

    return { id, fecha };
}

function verifyBirthdate(env, id, fecha) {
    if (!env.DATOS) return null;

    let datos;
    try {
        datos = JSON.parse(env.DATOS);
    } catch {
        return null;
    }

    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        return null;
    }

    const expected = datos[id]?.fecha_nacimiento;
    return typeof expected === 'string' && sameString(expected, fecha);
}

async function findCertificate(bucket, id) {
    const ids = [...new Set([id, id.toLowerCase()])];

    for (const prefix of CERTIFICATE_PREFIXES) {
        for (const candidateId of ids) {
            for (const suffix of CERTIFICATE_SUFFIXES) {
                const object = await bucket.get(`${prefix}/${candidateId}${suffix}`);
                if (object) return object;
            }

            const listed = await bucket.list({
                prefix: `${prefix}/${candidateId}`,
                limit: 20,
            });
            const candidate = listed.objects.find((item) => /cc-2026\.png$/i.test(item.key));

            if (candidate) {
                const object = await bucket.get(candidate.key);
                if (object) return object;
            }
        }
    }

    return null;
}

function getConvocatoriaKey(pathname) {
    const match = pathname.match(/^\/convocatorias\/([a-z0-9][a-z0-9_-]*)\.pdf$/i);
    return match ? `${CONVOCATORIA_PREFIX}${match[1].toLowerCase()}.pdf` : null;
}

function getQrKey(pathname) {
    const match = pathname.match(/^\/qr\/([a-z0-9][a-z0-9_-]*)\.(png|jpe?g|webp)$/i);
    if (!match) return null;

    const extension = match[2].toLowerCase();
    return {
        key: `${QR_PREFIX}${match[1].toLowerCase()}.${extension}`,
        contentType: QR_CONTENT_TYPES[extension],
    };
}

async function serveQr(request, env, pathname, cors) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    const qr = getQrKey(pathname);
    if (!qr) {
        return reply({ ok: false, error: 'not_found' }, 404, cors);
    }

    if (!env.CERTIFICADOS) {
        return reply({ ok: false, error: 'storage_not_configured' }, 500, cors);
    }

    const object = await env.CERTIFICADOS.get(qr.key);
    if (!object) {
        return reply({ ok: false, error: 'qr_not_found' }, 404, cors);
    }

    const filename = qr.key.split('/').pop();
    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get('inline') === '1' ? 'inline' : 'attachment';
    const headers = new Headers(cors);
    headers.set('content-type', qr.contentType);
    headers.set('content-length', String(object.size));
    headers.set('content-disposition', `${disposition}; filename="${filename}"`);
    headers.set('cache-control', 'public, max-age=3600');
    headers.set('x-content-type-options', 'nosniff');

    if (object.httpEtag) {
        headers.set('etag', object.httpEtag);

        if (request.headers.get('if-none-match') === object.httpEtag) {
            return new Response(null, { status: 304, headers });
        }
    }

    if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
    }

    return new Response(object.body, { status: 200, headers });
}

async function serveConvocatoria(request, env, pathname, cors) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    const key = getConvocatoriaKey(pathname);
    if (!key) {
        return reply({ ok: false, error: 'not_found' }, 404, cors);
    }

    if (!env.CERTIFICADOS) {
        return reply({ ok: false, error: 'storage_not_configured' }, 500, cors);
    }

    const object = await env.CERTIFICADOS.get(key);
    if (!object) {
        return reply({ ok: false, error: 'convocatoria_not_found' }, 404, cors);
    }

    const filename = key.split('/').pop();
    const headers = new Headers(cors);
    headers.set('content-type', 'application/pdf');
    headers.set('content-length', String(object.size));
    headers.set('content-disposition', `inline; filename="${filename}"`);
    headers.set('cache-control', 'public, max-age=3600');
    headers.set('x-content-type-options', 'nosniff');

    if (object.httpEtag) {
        headers.set('etag', object.httpEtag);

        if (request.headers.get('if-none-match') === object.httpEtag) {
            return new Response(null, { status: 304, headers });
        }
    }

    if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
    }

    return new Response(object.body, { status: 200, headers });
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        const { pathname } = new URL(request.url);

        if (pathname.startsWith('/convocatorias/')) {
            return serveConvocatoria(request, env, pathname, cors);
        }

        if (pathname.startsWith('/qr/')) {
            return serveQr(request, env, pathname, cors);
        }

        if (request.method !== 'POST') {
            return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
        }

        if (pathname !== '/verify' && pathname !== '/certificado') {
            return reply({ ok: false, error: 'not_found' }, 404, cors);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return reply({ ok: false, error: 'invalid_json' }, 400, cors);
        }

        const credentials = parseCredentials(body);
        if (!credentials) {
            return reply({ ok: false, error: 'invalid_request' }, 400, cors);
        }

        const { id, fecha } = credentials;
        const matches = verifyBirthdate(env, id, fecha);

        if (matches === null) {
            return reply({ ok: false, error: 'server_config' }, 500, cors);
        }

        if (!matches) {
            if (pathname === '/verify') {
                return reply({ ok: false }, 200, cors);
            }
            return reply({ ok: false, error: 'invalid_credentials' }, 403, cors);
        }

        if (pathname === '/verify') {
            return reply({ ok: true }, 200, cors);
        }

        if (!env.CERTIFICADOS) {
            return reply({ ok: false, error: 'certificates_not_configured' }, 500, cors);
        }

        const object = await findCertificate(env.CERTIFICADOS, id);
        if (!object) {
            return reply({ ok: false, error: 'certificate_not_found' }, 404, cors);
        }

        const filename = `${id}-CC-2026.png`;
        const contentType = object.httpMetadata?.contentType
            && object.httpMetadata.contentType !== 'application/octet-stream'
            ? object.httpMetadata.contentType
            : 'image/png';

        const headers = new Headers(cors);
        headers.set('content-type', contentType);
        headers.set('content-length', String(object.size));
        headers.set('content-disposition', `attachment; filename="${filename}"`);
        headers.set('cache-control', 'private, no-store');
        headers.set('x-content-type-options', 'nosniff');

        return new Response(object.body, { status: 200, headers });
    },
};
