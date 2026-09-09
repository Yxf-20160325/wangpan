/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发/生产使用不同的输出目录，避免互相覆盖（可用 NEXT_DIST_DIR 覆盖）
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === 'production' ? '.next-build' : '.next-app'),
  outputFileTracingRoot: process.cwd(),
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // 允许上传更大的文件到 Route Handler
    serverActions: {
      bodySizeLimit: '512mb',
    },
  },
};

export default nextConfig;
