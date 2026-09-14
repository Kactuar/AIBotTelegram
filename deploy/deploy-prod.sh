#!/usr/bin/env bash
set -euo pipefail

target_sha="${1:-}"
if [[ ! "$target_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <40-character lowercase commit SHA>" >&2
  exit 64
fi

readonly current_link="/srv/aibot/current"
readonly releases_root="/srv/aibot/releases"
readonly backups_root="/srv/aibot/backups"
readonly branch="master"
readonly health_url="http://127.0.0.1:3010/api/health/ready"
readonly pm2_bin="/home/deploy/.nvm/versions/node/v20.20.2/bin/pm2"

exec 9>"/srv/aibot/.deploy.lock"
flock 9

export NVM_DIR="/home/deploy/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
export AIBOT_NODE="$(nvm which 24)"

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
    if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

switch_current() {
  local release="$1"
  local candidate_link="${current_link}.next"
  ln -sfn "$release" "$candidate_link"
  mv -Tf "$candidate_link" "$current_link"
}

bootstrap_release_layout() {
  local previous_sha="$1"
  if [[ -L "$current_link" ]]; then
    return
  fi
  local previous_release="${releases_root}/${previous_sha}"
  if [[ -e "$previous_release" ]]; then
    echo "Cannot bootstrap releases: $previous_release already exists." >&2
    exit 66
  fi
  mkdir -p "$releases_root"
  mv "$current_link" "$previous_release"
  switch_current "$previous_release"
}

create_candidate() {
  local repository_root="$1"
  local candidate="$2"
  if [[ -e "$candidate" ]]; then
    echo "Candidate release already exists: $candidate" >&2
    exit 67
  fi
  git -C "$repository_root" worktree add --detach "$candidate" "$target_sha"
  ln -s /srv/aibot/.env "$candidate/.env.local"
}

remove_candidate() {
  local repository_root="$1"
  local candidate="$2"
  git -C "$repository_root" worktree remove --force "$candidate" || true
}

build_candidate() {
  local candidate="$1"
  local backup_file="$2"
  cd "$candidate"
  npm ci
  npm run db:backup -- "$backup_file"
  npm run db:migrate
  npm run verify
  npm run build
}

repository_root="$current_link"
cd "$repository_root"
previous_sha="$(git rev-parse HEAD)"

echo "Fetching $branch and validating requested SHA $target_sha..."
git fetch --no-tags origin "$branch"
resolved_sha="$(git rev-parse "${target_sha}^{commit}")"
if [[ "$resolved_sha" != "$target_sha" ]] || ! git merge-base --is-ancestor "$target_sha" "origin/$branch"; then
  echo "Requested SHA is not part of origin/$branch." >&2
  exit 65
fi

bootstrap_release_layout "$previous_sha"
previous_release="$(readlink -f "$current_link")"
candidate="${releases_root}/${target_sha}"
mkdir -p "$backups_root"
backup_file="${backups_root}/before-${target_sha}-$(date -u +%Y%m%dT%H%M%SZ).sqlite"

echo "Building isolated release $target_sha..."
create_candidate "$repository_root" "$candidate"
if ! build_candidate "$candidate" "$backup_file"; then
  echo "Build failed. Keeping $previous_sha running." >&2
  remove_candidate "$repository_root" "$candidate"
  exit 1
fi

echo "Promoting $target_sha and checking readiness..."
switch_current "$candidate"
if restart_processes && is_healthy; then
  "$pm2_bin" save
  echo "AIBot deployment succeeded at $target_sha. Backup: $backup_file"
  exit 0
fi

echo "Deployment health check failed. Rolling back to $previous_sha." >&2
switch_current "$previous_release"
restart_processes
is_healthy
"$pm2_bin" save || true
exit 1
