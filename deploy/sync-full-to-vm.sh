#!/usr/bin/env bash
# Mac: full SMACA overlay upload for smaca.unipi.gr VM
# Usage: ./deploy/sync-full-to-vm.sh [user@host]
#
# Upload only (no remote sudo). After upload, paste INSTALL block in VM SSH.
set -euo pipefail

REMOTE="${1:-chirpstack@192.168.158.9}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPLOAD="/tmp/smaca-full-sync"
APP="/var/www/smaca/app"

if [[ "${REMOTE}" == *"192.168.158." && "${REMOTE}" != *"192.168.158.9"* ]]; then
  echo "Error: incomplete IP — use chirpstack@192.168.158.9"
  exit 1
fi

echo "→ Prepare ${UPLOAD} on ${REMOTE}"
ssh "${REMOTE}" "rm -rf ${UPLOAD} && mkdir -p ${UPLOAD}"

echo "→ Upload overlay (app, routes, assets, resources, config)"
# IMPORTANT: This rsync uses --delete ONLY to refresh the staging directory
# on the VM (/tmp/smaca-full-sync). It must NEVER be used for:
# - /var/www/smaca
# - /var/www/smaca/app
rsync -avz --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'vendor/' \
  --exclude 'node_modules/' \
  --exclude 'storage/' \
  --exclude 'bootstrap/cache/*.php' \
  "${ROOT}/app/" "${REMOTE}:${UPLOAD}/app/"

rsync -avz \
  "${ROOT}/routes/" "${REMOTE}:${UPLOAD}/routes/"

rsync -avz \
  "${ROOT}/assets/" "${REMOTE}:${UPLOAD}/assets/"

rsync -avz \
  "${ROOT}/resources/" "${REMOTE}:${UPLOAD}/resources/"

rsync -avz \
  "${ROOT}/config/smaca_"*.php "${REMOTE}:${UPLOAD}/config/" 2>/dev/null || true

rsync -avz \
  "${ROOT}/deploy/vm-add-sensor-latest-iaq-columns.sql" \
  "${ROOT}/deploy/vm-verify-and-fix.sh" \
  "${REMOTE}:${UPLOAD}/" 2>/dev/null || true

cat <<EOF

══════════════════════════════════════════════════════════════
Upload complete → ${UPLOAD}/
Branch: $(git -C "${ROOT}" branch --show-current 2>/dev/null || echo '?')
Commit: $(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || echo '?')
══════════════════════════════════════════════════════════════

In VM SSH (chirpstack@192.168.158.9) paste this INSTALL block:

# 0) Restart PHP first (fixes 60s hangs when workers are stuck)
sudo systemctl restart php8.3-fpm nginx

# 0b) More FPM workers (default is often 5 — dashboard exhausts them)
if grep -q '^pm.max_children = 5' /etc/php/8.3/fpm/pool.d/www.conf 2>/dev/null; then
  sudo sed -i 's/^pm.max_children = 5/pm.max_children = 15/' /etc/php/8.3/fpm/pool.d/www.conf
  sudo systemctl restart php8.3-fpm
fi

# 1) Ensure public/assets symlink exists
if [[ ! -L ${APP}/public/assets ]]; then
  sudo ln -sfn ../assets ${APP}/public/assets
fi

# 2) Copy overlay files
sudo rsync -a ${UPLOAD}/app/ ${APP}/app/
sudo rsync -a ${UPLOAD}/routes/ ${APP}/routes/
sudo rsync -a ${UPLOAD}/assets/ ${APP}/assets/
sudo rsync -a ${UPLOAD}/resources/ ${APP}/resources/
sudo mkdir -p ${APP}/config
sudo rsync -a ${UPLOAD}/config/ ${APP}/config/ 2>/dev/null || true

# 3) Permissions + Laravel caches (NO migrate, NO route:cache)
sudo chown -R www-data:www-data ${APP}/app ${APP}/assets ${APP}/resources ${APP}/routes ${APP}/config
cd ${APP}
sudo -u www-data php artisan view:clear
sudo -u www-data php artisan route:clear

# 4) Optional DB columns (safe if already exist)
if [[ -f ${UPLOAD}/vm-add-sensor-latest-iaq-columns.sql ]]; then
  sudo mysql -u laravel -p'laravel' smaca < ${UPLOAD}/vm-add-sensor-latest-iaq-columns.sql || true
fi

# 5) Smoke tests (Host header required — bare 127.0.0.1 often returns 403)
H="Host: smaca.unipi.gr"
curl -sI -H "\$H" http://127.0.0.1/assets/vendor/highcharts/highcharts.js | head -1
curl -sI -H "\$H" http://127.0.0.1/assets/js/smaca-highcharts-loader.js | head -1
curl -w "login HTTP:%{http_code} TTFB:%{time_starttransfer}s\n" -o /dev/null -s -H "\$H" http://127.0.0.1/login
time curl -s -o /dev/null -w "sensors HTTP:%{http_code} %{time_total}s\n" -H "\$H" http://127.0.0.1/api/sensors

Then on Mac: hard-refresh http://smaca.unipi.gr/dashboard (Cmd+Shift+R)

DO NOT run: php artisan migrate | php artisan route:cache

EOF
