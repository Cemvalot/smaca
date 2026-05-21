#!/usr/bin/env bash
# Run ON the VM (chirpstacksrv) as a user with sudo.
set -euo pipefail

APP_ROOT="/var/www/smaca/app"
ENV_FILE="${APP_ROOT}/.env"
DB_NAME="${SMACA_DB_NAME:-smaca}"
DB_USER="${SMACA_DB_USER:-smaca}"

if [[ -z "${SMACA_DB_PASSWORD:-}" ]]; then
  echo "Set SMACA_DB_PASSWORD first, e.g.:"
  echo "  export SMACA_DB_PASSWORD='your-mysql-password'"
  exit 1
fi

if [[ ! -d "${APP_ROOT}" ]]; then
  echo "Missing ${APP_ROOT}"
  exit 1
fi

# Backup existing .env
if [[ -f "${ENV_FILE}" ]]; then
  sudo cp -a "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
fi

# MySQL database + user
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${SMACA_DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${SMACA_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# Write .env (keeps existing APP_KEY if present)
EXISTING_KEY=""
if [[ -f "${ENV_FILE}" ]]; then
  EXISTING_KEY=$(grep -E '^APP_KEY=' "${ENV_FILE}" | cut -d= -f2- || true)
fi

sudo tee "${ENV_FILE}" >/dev/null <<EOF
APP_NAME=SMACA
APP_ENV=production
APP_KEY=${EXISTING_KEY}
APP_DEBUG=false
APP_URL=http://smaca.unipi.gr

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${SMACA_DB_PASSWORD}

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync

CACHE_STORE=database

MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@unipi.gr
MAIL_FROM_NAME="\${APP_NAME}"

VITE_APP_NAME="\${APP_NAME}"
EOF

cd "${APP_ROOT}"

if ! grep -q '^APP_KEY=base64:' "${ENV_FILE}" 2>/dev/null; then
  sudo -u www-data php artisan key:generate --force
fi

sudo -u www-data php ../composer.phar install --no-dev --optimize-autoloader
# Do not migrate if DB already has data (readings, users, etc.)
# sudo -u www-data php artisan migrate --force
if [[ -f "${APP_ROOT}/../deploy/fix-vm-views.sh" ]]; then
  bash "${APP_ROOT}/../deploy/fix-vm-views.sh"
fi
sudo -u www-data php artisan config:cache
# SMACA uses route closures; route:cache breaks helpers — keep routes uncached
sudo -u www-data php artisan route:clear
sudo -u www-data php artisan view:cache

sudo chown www-data:www-data "${ENV_FILE}"
sudo chmod 640 "${ENV_FILE}"
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R ug+rwx storage bootstrap/cache

echo "Done. Test: http://smaca.unipi.gr/login"
