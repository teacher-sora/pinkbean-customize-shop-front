/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // X-Powered-By 헤더 제거(불필요한 정보 노출 방지)
  // NOTE (CDN phase): when wiring the real sprite renderer, set
  //   env.NEXT_PUBLIC_DATA_BASE = 'https://cdn.pinkbean-customize.com'
  // and (if using next/image for sprites) add the CDN host to images.remotePatterns.
};

export default nextConfig;
