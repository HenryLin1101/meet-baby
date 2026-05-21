import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "localhost:9000", "127.0.0.1:9000"],
};

export default nextConfig;
