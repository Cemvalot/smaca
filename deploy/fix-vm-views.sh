#!/usr/bin/env bash
# Run ON the VM after rsync — Laravel only loads views from resources/views/.
set -euo pipefail

APP_ROOT="/var/www/smaca/app"
cd "${APP_ROOT}"

for f in login landing register dashboard index smaca-dashboard welcome; do
  if [[ -f "${f}.blade.php" ]]; then
    sudo cp -f "${f}.blade.php" "resources/views/${f}.blade.php"
    echo "Copied ${f}.blade.php -> resources/views/"
  elif [[ ! -f "resources/views/${f}.blade.php" ]]; then
    echo "WARN: missing ${f}.blade.php (root and resources/views)"
  fi
done

sudo -u www-data php artisan view:clear
sudo -u www-data php artisan view:cache
echo "Views OK. Test: http://smaca.unipi.gr/login"
