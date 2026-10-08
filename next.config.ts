import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["isomorphic-dompurify", "mammoth", "unpdf"],
};

export default nextConfig;
