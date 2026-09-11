#!/bin/sh
set -eu

case "$RENEWED_LINEAGE" in
  */95.216.200.181) ;;
  *) exit 0 ;;
esac

install -d -o caddy -g caddy -m 750 /etc/caddy/certs/aibot
install -o caddy -g caddy -m 640 "$RENEWED_LINEAGE/fullchain.pem" /etc/caddy/certs/aibot/fullchain.pem
install -o caddy -g caddy -m 640 "$RENEWED_LINEAGE/privkey.pem" /etc/caddy/certs/aibot/privkey.pem
/usr/bin/caddy validate --config /etc/caddy/Caddyfile
/usr/bin/systemctl reload caddy
