import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile shared TS package dari monorepo (packages/shared).
  transpilePackages: ["@ajo/shared"],
  // Vercel: Root Directory di-set ke apps/admin, tapi install & workspace
  // symlink (@ajo/shared, lockfile) ada di root repo. Pin tracing root ke root
  // monorepo agar file tracing benar & Next tak salah menebak root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
