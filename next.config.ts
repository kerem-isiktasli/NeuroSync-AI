import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bullmq", "ioredis", "pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
