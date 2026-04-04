/**
 * Next.js 14 reads `next.config.{js,mjs}` only. If you upgrade to Next.js 15+, you can migrate this file to `next.config.ts`.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  transpilePackages: ["firebase", "@firebase/app", "@firebase/auth", "@firebase/firestore", "@firebase/storage"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
