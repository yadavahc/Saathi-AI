/** @type {import('next').NextConfig} */
const BACKEND = process.env.SAATHI_BACKEND_URL || "http://127.0.0.1:8000";
module.exports = {
  reactStrictMode: false,
  // Proxy /api/* to FastAPI so the browser talks to one origin (audio URLs, no CORS).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
