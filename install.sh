#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DATA_ROOT=${XDG_DATA_HOME:-"$HOME/.local/share"}
BIN_ROOT="$HOME/.local/bin"
INSTALL_DIR="$DATA_ROOT/lipano"
APPLICATIONS_DIR="$DATA_ROOT/applications"
ICON_DIR="$DATA_ROOT/icons/hicolor/scalable/apps"
CONFIG_ROOT=${XDG_CONFIG_HOME:-"$HOME/.config"}
LAUNCHER="$BIN_ROOT/lipano"

if [ -d "$CONFIG_ROOT/siam-keys" ] && [ ! -d "$CONFIG_ROOT/lipano" ]; then
  mv "$CONFIG_ROOT/siam-keys" "$CONFIG_ROOT/lipano"
fi

mkdir -p "$INSTALL_DIR/assets" "$BIN_ROOT" "$APPLICATIONS_DIR" "$ICON_DIR"
cp "$SOURCE_DIR/index.html" "$SOURCE_DIR/styles.css" "$SOURCE_DIR/app.js" "$SOURCE_DIR/desktop.py" "$INSTALL_DIR/"
cp "$SOURCE_DIR/assets/icon.svg" "$INSTALL_DIR/assets/icon.svg"
cp "$SOURCE_DIR/assets/icon.svg" "$ICON_DIR/lipano.svg"
chmod +x "$INSTALL_DIR/desktop.py"

sed "s|@EXEC@|$LAUNCHER|g" "$SOURCE_DIR/lipano.desktop.in" > "$APPLICATIONS_DIR/lipano.desktop"
chmod +x "$APPLICATIONS_DIR/lipano.desktop"

cat > "$LAUNCHER" <<EOF
#!/usr/bin/env sh
exec python3 "$INSTALL_DIR/desktop.py" "\$@"
EOF
chmod +x "$LAUNCHER"

rm -f "$BIN_ROOT/siam-keys"
rm -f "$APPLICATIONS_DIR/siam-keys.desktop"
rm -f "$ICON_DIR/siam-keys.svg"
rm -rf "$DATA_ROOT/siam-keys"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi

echo "ติดตั้ง lipano สำเร็จ"
echo "เปิดจากเมนูแอป หรือใช้คำสั่ง: $LAUNCHER"
