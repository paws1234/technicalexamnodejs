import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 otherwise generates AGENTS.md / CLAUDE.md next to this file on every
  // dev/build run; they are not part of this project.
  agentRules: false,
};

export default nextConfig;
