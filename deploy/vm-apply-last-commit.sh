#!/usr/bin/env bash
#
# Apply the incremental staging bundle uploaded to the VM by:
#   ./scripts/deploy-last-commit.sh
#
# PRODUCTION NOTES (SAFE workflow):
# Production Laravel root is /var/www/smaca/app
# /var/www/smaca is NOT the Laravel app root (it contains the app directory).
# Incremental deploys must never use delete-based sync against production.
set -euo pipefail

APP="/var/www/smaca/app"
UPLOAD="/tmp/smaca_last_commit"
FILES="/tmp/deploy-last-commit.files"
HOST_HEADER="Host: smaca.unipi.gr"

if [[ ! -d "${UPLOAD}" ]]; then
  echo "ERROR: missing staging directory: ${UPLOAD}"
  exit 1
fi

if [[ ! -f "${FILES}" ]]; then
  echo "ERROR: missing files list: ${FILES}"
  exit 1
fi

echo "========== Files to deploy =========="
if [[ ! -s "${FILES}" ]]; then
  echo "(files list is empty; nothing to deploy)"
else
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    echo "${f}"
  done < "${FILES}"
fi

echo ""
echo "========== 1) Incremental rsync to production =========="
# Never use --delete here (safe incremental update only).
sudo rsync -av --files-from="${FILES}" "${UPLOAD}/" "${APP}/"

echo ""
echo "========== 2) Permissions =========="
sudo chown -R www-data:www-data "${APP}"

echo ""
echo "========== 3) Laravel cache reset (SAFE order) =========="
cd "${APP}"
sudo -u www-data php artisan config:clear
sudo -u www-data php artisan cache:clear
sudo -u www-data php artisan route:clear
sudo -u www-data php artisan view:clear

echo ""
echo "========== 4) Smoke tests =========="
curl -sI -H "${HOST_HEADER}" http://127.0.0.1/landing | head -1 || echo "landing: FAIL"
curl -sI -H "${HOST_HEADER}" http://127.0.0.1/login | head -1 || echo "login: FAIL"
curl -sI -H "${HOST_HEADER}" http://127.0.0.1/dashboard | head -1 || echo "dashboard: FAIL"

echo ""
echo "Done."

