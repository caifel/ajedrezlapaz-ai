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
        return item;
      },
    }),
  ],
});
