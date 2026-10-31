/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/studio',
  images: { unoptimized: true },
  async redirects() {
    return [
      { source: '/', destination: 'https://sonceibe-studio.vercel.app/studio', basePath: false, permanent: false },
      { source: '/access', destination: 'https://sonceibe-studio.vercel.app/studio/access', basePath: false, permanent: false },
      { source: '/download/windows', destination: 'https://sonceibe-studio.vercel.app/studio/download/windows', basePath: false, permanent: false },
    ];
  },
  async headers() {
    return [{ source: '/access', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};

module.exports = nextConfig;
