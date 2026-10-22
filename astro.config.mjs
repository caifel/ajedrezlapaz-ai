import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ajedrezlapaz.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
      changefreq: 'monthly',
      priority: 0.7,
      serialize(item) {
        if (item.url === 'https://ajedrezlapaz.com/') {
          return { ...item, changefreq: 'weekly', priority: 1 };
        }
        if (item.url === 'https://ajedrezlapaz.com/torneos/') {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }
        if (item.url.includes('/torneos/')) {
          return { ...item, changefreq: 'monthly', priority: 0.8 };
        }
        return item;
      },
    }),
  ],
});
