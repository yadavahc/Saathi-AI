/** @type {import('next').NextConfig} */
const BACKEND = process.env.SAATHI_BACKEND_URL || "http://127.0.0.1:8000";
module.exports = {
  reactStrictMode: false,
  // A second instance (e.g. a sandbox dev server) can build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Proxy /api/* to FastAPI so the browser talks to one origin (audio URLs, no CORS).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
