const nextConfig = {
  reactStrictMode: true,

  output: 'standalone',

  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,

  transpilePackages: ['@drive/ui', '@drive/core', '@drive/api-client'],
};

export default nextConfig;
