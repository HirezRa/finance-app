#!/bin/bash
# Install Finance App Updater on LXC

set -euo pipefail

APP_DIR="/opt/finance-app"
SCRIPTS_DIR="$APP_DIR/scripts"
SYSTEMD_DIR="/etc/systemd/system"

echo "Installing Finance App Updater..."

chmod +x "$SCRIPTS_DIR/safe-update.sh"
cp "$SCRIPTS_DIR/systemd/finance-app-updater.path" "$SYSTEMD_DIR/"
cp "$SCRIPTS_DIR/systemd/finance-app-updater.service" "$SYSTEMD_DIR/"

systemctl daemon-reload
systemctl enable finance-app-updater.path
systemctl start finance-app-updater.path

echo "Updater installed successfully!"
echo "Status: $(systemctl is-active finance-app-updater.path)"
