/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@libsql/client', 'libsql'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};
export default nextConfig;
