/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // X-Powered-By 헤더 제거(불필요한 정보 노출 방지)
  // 코디 광장 참고 이미지(Supabase Storage 공개 버킷)를 next/image 로 줄여 보낸다 — 원본(최대 5MB)을 매번 내려받지 않게.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 경로에 올린 시각이 들어가 같은 주소의 그림은 바뀌지 않는다
  },
  // NOTE (CDN phase): when wiring the real sprite renderer, set
  //   env.NEXT_PUBLIC_DATA_BASE = 'https://cdn.pinkbean-customize.com'
  // and (if using next/image for sprites) add the CDN host to images.remotePatterns.
};

export default nextConfig;
