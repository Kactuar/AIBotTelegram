import type { NextConfig } from "next";

// CI runs `npm run verify` before `npm run build`; avoid Next 15 invoking its
// legacy lint integration a second time when the repository uses flat config.
const nextConfig: NextConfig = { eslint: { ignoreDuringBuilds: true } };
export default nextConfig;
