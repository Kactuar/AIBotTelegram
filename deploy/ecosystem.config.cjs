const path = require("node:path");
const node = process.env.AIBOT_NODE;
if (!node || !path.isAbsolute(node)) {
  throw new Error('Set AIBOT_NODE to an absolute Node.js 24 path before starting PM2: export AIBOT_NODE="$(nvm which 24)"');
}

module.exports = {
  apps: [
    {
      name: "aibot-web",
      cwd: "/srv/aibot/current",
      script: "node_modules/next/dist/bin/next",
      interpreter: node,
      args: "start -H 127.0.0.1 -p 3010",
      env: { NODE_ENV: "production", PORT: "3010" },
      max_memory_restart: "500M",
    },
    {
      name: "aibot-worker",
      cwd: "/srv/aibot/current",
      script: "src/worker.ts",
      interpreter: node,
      node_args: "--import tsx",
      env: { NODE_ENV: "production", AIBOT_ENV_PATH: "/srv/aibot/.env" },
      max_memory_restart: "500M",
    },
  ],
};
