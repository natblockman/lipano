#!/usr/bin/env sh
set -eu

DATA_ROOT=${XDG_DATA_HOME:-"$HOME/.local/share"}
CONFIG_ROOT=${XDG_CONFIG_HOME:-"$HOME/.config"}
BIN_ROOT="$HOME/.local/bin"

rm -f "$BIN_ROOT/lipano" "$BIN_ROOT/siam-keys"
rm -f "$DATA_ROOT/applications/lipano.desktop" "$DATA_ROOT/applications/siam-keys.desktop"
rm -f "$DATA_ROOT/icons/hicolor/scalable/apps/lipano.svg" "$DATA_ROOT/icons/hicolor/scalable/apps/siam-keys.svg"
rm -rf "$DATA_ROOT/lipano" "$DATA_ROOT/siam-keys"
rm -rf "$CONFIG_ROOT/lipano" "$CONFIG_ROOT/siam-keys"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DATA_ROOT/applications" >/dev/null 2>&1 || true
fi

echo "ถอนการติดตั้ง lipano แล้ว"
