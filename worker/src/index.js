const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
};

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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        if (request.method !== 'POST') {
            return reply({ ok: false }, 405, cors);
        }

        if (new URL(request.url).pathname !== '/verify') {
            return reply({ ok: false }, 404, cors);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return reply({ ok: false }, 400, cors);
        }

        const id = typeof body?.id === 'string' ? body.id.trim() : '';
        const fecha = typeof body?.fecha === 'string' ? body.fecha.trim() : '';

        if (!/^ADALP-\d{4}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return reply({ ok: false }, 400, cors);
        }

        if (!env.DATOS) {
            return reply({ ok: false }, 500, cors);
        }

        let datos;
        try {
            datos = JSON.parse(env.DATOS);
        } catch {
            return reply({ ok: false }, 500, cors);
        }

        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
            return reply({ ok: false }, 500, cors);
        }

        const expected = datos[id]?.fecha_nacimiento;
        const ok = typeof expected === 'string' && sameString(expected, fecha);

        return reply({ ok }, 200, cors);
    },
};
