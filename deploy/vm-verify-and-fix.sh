#!/usr/bin/env bash
# Run ON the VM (inside SSH): bash /tmp/smaca-full-sync/vm-verify-and-fix.sh
# Or after upload: scp deploy/vm-verify-and-fix.sh chirpstack@192.168.158.9:/tmp/
set -euo pipefail

# Production Laravel root is /var/www/smaca/app
# /var/www/smaca is NOT the Laravel app root (it contains the app directory).
# Incremental deploys must never use delete-based sync against production.
APP="/var/www/smaca/app"
UPLOAD="/tmp/smaca-full-sync"
POOL="/etc/php/8.3/fpm/pool.d/www.conf"

echo "========== 1) Upload staging =========="
if [[ -d "${UPLOAD}/app" ]]; then
  echo "OK: ${UPLOAD} exists (commit bundle uploaded)"
  ls -la "${UPLOAD}/assets/vendor/highcharts/" 2>/dev/null | head -5 || true
else
  echo "MISSING: ${UPLOAD} — run ./deploy/sync-full-to-vm.sh from Mac first"
  exit 1
fi

echo ""
echo "========== 2) Installed on app? =========="
for f in \
  "${APP}/assets/js/smaca-highcharts-loader.js" \
  "${APP}/assets/vendor/highcharts/highcharts.js" \
  "${APP}/app/Support/SmacaPassword.php" \
  "${APP}/routes/smaca-api-helpers.php" \
  "${APP}/resources/views/login.blade.php"; do
  if [[ -f "$f" ]]; then
    echo "OK  $f ($(stat -c '%y' "$f" 2>/dev/null || stat -f '%Sm' "$f"))"
  else
    echo "MISSING  $f"
  fi
done

echo ""
echo "========== 3) public/assets symlink =========="
ls -la "${APP}/public/assets" 2>/dev/null || echo "MISSING symlink ${APP}/public/assets"

echo ""
echo "========== 4) PHP-FPM =========="
grep -E '^pm\.(max_children|max_requests)' "$POOL" 2>/dev/null || true
systemctl is-active php8.3-fpm nginx || true

echo ""
echo "========== 5) HTTP smoke (use Host: smaca.unipi.gr) =========="
H="Host: smaca.unipi.gr"
curl -sI --max-time 10 -H "$H" http://127.0.0.1/login | head -1 || echo "login: FAIL/timeout"
curl -sI --max-time 10 -H "$H" http://127.0.0.1/assets/vendor/highcharts/highcharts.js | head -1 || echo "highcharts: FAIL"
curl -sI --max-time 10 -H "$H" http://127.0.0.1/assets/js/smaca-highcharts-loader.js | head -1 || echo "loader: FAIL"
curl -w "sensors: HTTP:%{http_code} %{time_total}s\n" -o /dev/null -s --max-time 25 -H "$H" http://127.0.0.1/api/sensors || echo "sensors: FAIL/timeout"

echo ""
echo "========== 6) Auto-fix (install + restart) =========="
read -r -p "Run install from ${UPLOAD} and restart php-fpm? [y/N] " ans
if [[ "${ans}" =~ ^[yY]$ ]]; then
  sudo systemctl restart php8.3-fpm nginx

  if [[ ! -L "${APP}/public/assets" ]]; then
    sudo ln -sfn ../assets "${APP}/public/assets"
  fi

  sudo rsync -a "${UPLOAD}/app/" "${APP}/app/"
  sudo rsync -a "${UPLOAD}/routes/" "${APP}/routes/"
  sudo rsync -a "${UPLOAD}/assets/" "${APP}/assets/"
  sudo rsync -a "${UPLOAD}/resources/" "${APP}/resources/"
  sudo mkdir -p "${APP}/config"
  sudo rsync -a "${UPLOAD}/config/" "${APP}/config/" 2>/dev/null || true
  sudo chown -R www-data:www-data "${APP}/app" "${APP}/assets" "${APP}/resources" "${APP}/routes" "${APP}/config"

  if [[ -f "${UPLOAD}/vm-add-sensor-latest-iaq-columns.sql" ]]; then
    sudo mysql -u laravel -p'laravel' smaca < "${UPLOAD}/vm-add-sensor-latest-iaq-columns.sql" 2>/dev/null || true
  fi

  if grep -q '^pm.max_children = 5' "$POOL" 2>/dev/null; then
    echo "Bumping pm.max_children 5 → 15"
    sudo sed -i 's/^pm.max_children = 5/pm.max_children = 15/' "$POOL"
    sudo systemctl restart php8.3-fpm
  fi

  cd "${APP}"
  # SAFE incremental cache reset order:
  # 1) config:clear
  # 2) cache:clear
  # 3) route:clear
  # 4) view:clear
  sudo -u www-data php artisan config:clear
  sudo -u www-data php artisan cache:clear
  sudo -u www-data php artisan route:clear
  sudo -u www-data php artisan view:clear

  echo "Done. Re-run section 5 curls from Mac/browser."
fi
