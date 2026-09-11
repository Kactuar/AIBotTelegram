# CI/CD setup

Pushes and pull requests to `master` verify the exact commit with Node.js 24. A successful push asks Hetzner to deploy that same SHA only after the repository variable `AIBOT_DEPLOY_ENABLED` is set to `true`. The server verifies that the SHA belongs to `origin/master` before changing files.

## GitHub access from Hetzner

Create a separate read-only Deploy Key on Hetzner:

```bash
ssh-keygen -t ed25519 -f /home/deploy/.ssh/aibot_github_ed25519 -C "aibot-server-readonly"
cat /home/deploy/.ssh/aibot_github_ed25519.pub
```

Add the printed public key at GitHub repository **Settings -> Deploy keys -> Add deploy key**. Do not select write access. Append this host alias to `/home/deploy/.ssh/config`:

```text
Host github.com-aibot
  HostName github.com
  User git
  IdentityFile /home/deploy/.ssh/aibot_github_ed25519
  IdentitiesOnly yes
```

This leaves the existing `github.com` identity used by Bookilion unchanged.

## GitHub Actions access to Hetzner

Generate a separate key locally for the GitHub Actions runner. Add its public half to `/home/deploy/.ssh/authorized_keys`; add its private half only as the `HETZNER_SSH_KEY` GitHub Actions secret. The other required repository secrets are:

```text
HETZNER_HOST=95.216.200.181
HETZNER_USER=deploy
HETZNER_KNOWN_HOSTS=95.216.200.181 ssh-ed25519 <server-public-host-key>
```

Read the trusted host key from the already connected server with:

```bash
printf '95.216.200.181 '
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

## One-time server bootstrap

Clone and build a candidate before replacing the live directory. `/srv/aibot/.env`, SQLite and video storage stay outside the checkout.

```bash
cd /srv/aibot
git clone --branch master --single-branch git@github.com-aibot:Kactuar/AIBotTelegram.git current-candidate
ln -s /srv/aibot/.env /srv/aibot/current-candidate/.env.local

source /home/deploy/.nvm/nvm.sh
nvm use 24
cd /srv/aibot/current-candidate
npm ci
npm run verify
npm run build
```

After these checks pass, rename the old `current` directory to `current.before-cicd`, rename `current-candidate` to `current`, and restart only `aibot-web` and `aibot-worker`. Keep the old directory until the health check succeeds.

## Normal deployment

After bootstrap, add the GitHub Actions repository variable `AIBOT_DEPLOY_ENABLED=true`. A push to `master` then locks deployments, builds before restart, checks `http://127.0.0.1:3010/mini-app`, and rolls back to the previous Git commit on failure.
