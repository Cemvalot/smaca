#!/usr/bin/env bash
# Run from Mac: ./deploy/sync-highcharts-to-vm.sh [user@host]
set -euo pipefail

REMOTE="${1:-chirpstack@192.168.158.9}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="/var/www/smaca/app"

if [[ ! -f "${ROOT}/assets/vendor/highcharts/highcharts.js" ]]; then
  echo "Missing ${ROOT}/assets/vendor/highcharts/highcharts.js — run from repo with vendor files present."
  exit 1
fi

UPLOAD_DIR="/tmp/smaca-highcharts-upload"

echo "→ Prepare upload dir on ${REMOTE}"
ssh "${REMOTE}" "mkdir -p ${UPLOAD_DIR}/highcharts"

echo "→ Upload Highcharts + loader + dashboard layout"
rsync -avz \
  "${ROOT}/assets/vendor/highcharts/" \
  "${REMOTE}:${UPLOAD_DIR}/highcharts/"

rsync -avz \
  "${ROOT}/assets/js/smaca-highcharts-loader.js" \
  "${ROOT}/resources/views/dashboard/layouts/app.blade.php" \
  "${REMOTE}:${UPLOAD_DIR}/"

echo "→ Install on VM"
ssh "${REMOTE}" "set -e
  sudo mkdir -p ${APP}/assets/vendor/highcharts ${APP}/assets/js
  sudo cp ${UPLOAD_DIR}/highcharts/highcharts.js ${UPLOAD_DIR}/highcharts/heatmap.js ${APP}/assets/vendor/highcharts/
  sudo cp ${UPLOAD_DIR}/smaca-highcharts-loader.js ${APP}/assets/js/
  sudo cp ${UPLOAD_DIR}/app.blade.php ${APP}/resources/views/dashboard/layouts/
  sudo chown -R www-data:www-data ${APP}/assets/vendor/highcharts ${APP}/assets/js/smaca-highcharts-loader.js
  cd ${APP} && sudo -u www-data php artisan view:clear
  ls -la ${APP}/assets/vendor/highcharts/
  curl -sI http://127.0.0.1/assets/vendor/highcharts/highcharts.js | head -3 || true
"

echo "Done. Hard-refresh http://smaca.unipi.gr/dashboard"
