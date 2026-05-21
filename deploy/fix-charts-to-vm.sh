#!/usr/bin/env bash
# Mac: upload only (no sudo). Then paste install block in your VM SSH session.
# Usage: ./deploy/fix-charts-to-vm.sh [user@host]
set -euo pipefail

REMOTE="${1:-chirpstack@192.168.158.9}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPLOAD="/tmp/smaca-charts-fix"

if [[ "${REMOTE}" == *"192.168.158." && "${REMOTE}" != *"192.168.158.9"* ]]; then
  echo "Error: incomplete IP — use chirpstack@192.168.158.9"
  exit 1
fi

echo "→ Upload chart fix bundle to ${REMOTE}"
ssh "${REMOTE}" "rm -rf ${UPLOAD} && mkdir -p ${UPLOAD}/vendor/highcharts ${UPLOAD}/js ${UPLOAD}/views/dashboard/layouts"

rsync -avz \
  "${ROOT}/assets/vendor/highcharts/" \
  "${REMOTE}:${UPLOAD}/vendor/highcharts/"

rsync -avz \
  "${ROOT}/assets/js/smaca-highcharts-loader.js" \
  "${ROOT}/assets/js/smaca-highcharts-adapter.js" \
  "${ROOT}/assets/js/smaca-telemetry-bootstrap.js" \
  "${ROOT}/assets/js/smaca-production-features.js" \
  "${ROOT}/assets/js/smaca-telemetry.js" \
  "${ROOT}/assets/js/smaca-chart-visibility.js" \
  "${REMOTE}:${UPLOAD}/js/"

rsync -avz \
  "${ROOT}/resources/views/dashboard/layouts/app.blade.php" \
  "${REMOTE}:${UPLOAD}/views/dashboard/layouts/"

cat <<'EOF'

Upload done → files in /tmp/smaca-charts-fix/

In your VM SSH session (chirpstack@192.168.158.9), paste:

sudo systemctl restart php8.3-fpm nginx

sudo mkdir -p /var/www/smaca/app/assets/vendor/highcharts /var/www/smaca/app/assets/js
sudo cp /tmp/smaca-charts-fix/vendor/highcharts/*.js /var/www/smaca/app/assets/vendor/highcharts/
sudo cp /tmp/smaca-charts-fix/js/*.js /var/www/smaca/app/assets/js/
sudo cp /tmp/smaca-charts-fix/views/dashboard/layouts/app.blade.php \
  /var/www/smaca/app/resources/views/dashboard/layouts/
sudo chown -R www-data:www-data /var/www/smaca/app/assets/vendor/highcharts /var/www/smaca/app/assets/js
cd /var/www/smaca/app && sudo -u www-data php artisan view:clear

curl -w "TTFB:%{time_starttransfer}s\n" -o /dev/null -s http://127.0.0.1/login

Then hard-refresh http://smaca.unipi.gr/dashboard (Cmd+Shift+R)

EOF
