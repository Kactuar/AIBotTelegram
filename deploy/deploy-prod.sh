#!/usr/bin/env bash
set -euo pipefail

target_sha="${1:-}"
if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <40-character lowercase commit SHA>" >&2
  exit 64
fi

readonly repository_root="/srv/aibot/current"
readonly branch="master"
readonly health_url="http://127.0.0.1:3010/mini-app"
readonly pm2_bin="/home/deploy/.nvm/versions/node/v20.20.2/bin/pm2"

exec 9>"/srv/aibot/.deploy.lock"
flock 9

export NVM_DIR="/home/deploy/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
export AIBOT_NODE="$(nvm which 24)"

checkout_sha() {
  git -C "$repository_root" checkout --detach --force "$1"
  git -C "$repository_root" reset --hard "$1"
  git -C "$repository_root" clean -fd
}

build_project() {
  cd "$repository_root"
  npm ci
  npm run verify
  npm run build
}

restart_processes() {
  if "$pm2_bin" describe aibot-web >/dev/null 2>&1; then
    "$pm2_bin" restart aibot-web --update-env
  else
    "$pm2_bin" start deploy/ecosystem.config.cjs --only aibot-web
  fi

  if "$pm2_bin" describe aibot-worker >/dev/null 2>&1; then
    "$pm2_bin" restart aibot-worker --update-env
  else
    "$pm2_bin" start deploy/ecosystem.config.cjs --only aibot-worker
  fi
}

is_healthy() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null &&
      [[ "$("$pm2_bin" pid aibot-worker)" != "0" ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

cd "$repository_root"
previous_sha="$(git rev-parse HEAD)"

echo "Fetching $branch and validating requested SHA $target_sha..."
git fetch --no-tags origin "$branch"
resolved_sha="$(git rev-parse "${target_sha}^{commit}")"
if [[ "$resolved_sha" != "$target_sha" ]] || ! git merge-base --is-ancestor "$target_sha" "origin/$branch"; then
  echo "Requested SHA is not part of origin/$branch." >&2
  exit 65
fi

echo "Building $target_sha before restart..."
if ! checkout_sha "$target_sha" || ! build_project; then
  echo "Build failed. Restoring $previous_sha without restarting services." >&2
  checkout_sha "$previous_sha"
  build_project || true
  exit 1
fi

echo "Restarting aibot processes and checking health..."
if restart_processes && is_healthy; then
  "$pm2_bin" save
  echo "AIBot deployment succeeded at $target_sha."
  exit 0
fi

echo "Deployment health check failed. Rolling back to $previous_sha." >&2
checkout_sha "$previous_sha"
build_project
restart_processes
is_healthy
"$pm2_bin" save || true
exit 1
