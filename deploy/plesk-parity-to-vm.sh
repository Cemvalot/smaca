#!/usr/bin/env bash
# Full parity: Mac code (UI) + Plesk DB → smaca.unipi.gr VM
#
# Prereqs on Mac:
#   - branch feature/dashboard-highcharts-views-vm (or your VM branch)
#   - SQL dump: breakeven_smaca_YYYY-MM-DD.sql or .sql.zip in repo root or pass path
#
# Usage:
#   ./deploy/plesk-parity-to-vm.sh
#   ./deploy/plesk-parity-to-vm.sh /path/to/breakeven_smaca.sql.zip
#   ./deploy/plesk-parity-to-vm.sh chirpstack@192.168.158.9 /path/to/dump.sql
set -euo pipefail

REMOTE="${1:-chirpstack@192.168.158.9}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_ARG="${2:-}"

if [[ "${REMOTE}" == *@* ]] && [[ -f "${1:-}" ]]; then
  SQL_ARG="${1}"
  REMOTE="chirpstack@192.168.158.9"
fi

if [[ -n "${SQL_ARG}" && -f "${SQL_ARG}" ]]; then
  SQL_PATH="${SQL_ARG}"
elif [[ -f "${ROOT}/breakeven_smaca_2026-05-26_13-03-05.sql.zip" ]]; then
  SQL_PATH="${ROOT}/breakeven_smaca_2026-05-26_13-03-05.sql.zip"
else
  SQL_PATH="$(ls -t "${ROOT}"/breakeven_smaca_*.sql "${ROOT}"/breakeven_smaca_*.sql.zip 2>/dev/null | head -1 || true)"
fi

if [[ -z "${SQL_PATH}" || ! -f "${SQL_PATH}" ]]; then
  echo "Missing SQL dump. Put breakeven_smaca_*.sql(.zip) in repo root or pass path:"
  echo "  ./deploy/plesk-parity-to-vm.sh chirpstack@192.168.158.9 ~/Downloads/breakeven_smaca.sql.zip"
  exit 1
fi

WORK="${ROOT}/.deploy-tmp"
rm -rf "${WORK}"
mkdir -p "${WORK}"

if [[ "${SQL_PATH}" == *.zip ]]; then
  echo "→ Unzip ${SQL_PATH}"
  unzip -q -o "${SQL_PATH}" -d "${WORK}"
  SQL_FILE="$(ls -t "${WORK}"/*.sql 2>/dev/null | head -1)"
else
  SQL_FILE="${SQL_PATH}"
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "No .sql found inside archive"
  exit 1
fi

echo "→ SQL file: ${SQL_FILE} ($(du -h "${SQL_FILE}" | cut -f1))"
echo "→ Upload code (overlay) …"
"${ROOT}/deploy/sync-full-to-vm.sh" "${REMOTE}"

echo "→ Upload database dump to VM /tmp/ …"
REMOTE_SQL="/tmp/breakeven_smaca_import.sql"
scp "${SQL_FILE}" "${REMOTE}:${REMOTE_SQL}"

cat <<EOF

══════════════════════════════════════════════════════════════
CODE uploaded → /tmp/smaca-full-sync/
DB uploaded   → ${REMOTE_SQL}
Branch: $(git -C "${ROOT}" branch --show-current 2>/dev/null) @ $(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null)
══════════════════════════════════════════════════════════════

SSH to VM and paste this FULL INSTALL block (code + database):

# --- A) PHP / workers ---
sudo systemctl restart php8.3-fpm nginx
if grep -q '^pm.max_children = 5' /etc/php/8.3/fpm/pool.d/www.conf 2>/dev/null; then
  sudo sed -i 's/^pm.max_children = 5/pm.max_children = 15/' /etc/php/8.3/fpm/pool.d/www.conf
  sudo systemctl restart php8.3-fpm
fi

# --- B) Install Mac code (UI) ---
if [[ ! -L /var/www/smaca/app/public/assets ]]; then
  sudo ln -sfn ../assets /var/www/smaca/app/public/assets
fi
sudo rsync -a /tmp/smaca-full-sync/app/ /var/www/smaca/app/app/
sudo rsync -a /tmp/smaca-full-sync/routes/ /var/www/smaca/app/routes/
sudo rsync -a /tmp/smaca-full-sync/assets/ /var/www/smaca/app/assets/
sudo rsync -a /tmp/smaca-full-sync/resources/ /var/www/smaca/app/resources/
sudo mkdir -p /var/www/smaca/app/config
sudo rsync -a /tmp/smaca-full-sync/config/ /var/www/smaca/app/config/ 2>/dev/null || true
sudo chown -R www-data:www-data /var/www/smaca/app/app /var/www/smaca/app/assets /var/www/smaca/app/resources /var/www/smaca/app/routes /var/www/smaca/app/config

# --- C) Import Plesk DB (2–5 min, do NOT interrupt) ---
sudo mysql -u laravel -p'laravel' smaca < ${REMOTE_SQL}

# --- D) Post-import + Laravel cache ---
sudo mysql -u laravel -p'laravel' smaca -e "
  SELECT COUNT(*) AS readings FROM readings;
  SELECT MAX(measured_at) AS latest_reading FROM readings;
  SELECT NOW() AS server_now;
"
sudo mysql -u laravel -p'laravel' smaca -e "
UPDATE sensors s
INNER JOIN sensor_latest sl ON sl.sensor_id = s.id
SET s.last_seen_at = sl.measured_at
WHERE sl.measured_at IS NOT NULL;
"

if [[ -f /tmp/smaca-full-sync/vm-add-sensor-latest-iaq-columns.sql ]]; then
  sudo mysql -u laravel -p'laravel' smaca < /tmp/smaca-full-sync/vm-add-sensor-latest-iaq-columns.sql 2>/dev/null || true
fi

cd /var/www/smaca/app
sudo -u www-data php artisan view:clear
sudo -u www-data php artisan route:clear
sudo systemctl restart php8.3-fpm nginx

# --- E) Smoke tests ---
H="Host: smaca.unipi.gr"
curl -sI -H "\$H" http://127.0.0.1/login | head -1
time curl -s -o /dev/null -w "sensors HTTP:%{http_code} %{time_total}s\n" -H "\$H" http://127.0.0.1/api/sensors

# latest_reading should be TODAY (near server_now), not 2026-05-19

Then on Mac: Cmd+Shift+R on http://smaca.unipi.gr/dashboard

DO NOT: php artisan migrate | php artisan route:cache

Note: For ongoing live data like break-even, later point ingest to:
  http://smaca.unipi.gr/api/readings/ingest

EOF

rm -rf "${WORK}"
