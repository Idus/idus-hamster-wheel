#!/usr/bin/env bash
# Idus Hamster Wheel installer  ·  v1.0  ·  build 2026-11-17
# Installs the Idus Hamster Wheel plugin into OpenDeck (native or Flatpak) for the current user.
#   bash install-idus-hamster-wheel.sh             install / update
#   bash install-idus-hamster-wheel.sh --uninstall remove the plugin (your key layout stays in OpenDeck)
# Changes nothing outside OpenDeck's plugin folder and ~/.local/share/fonts/idus — no sudo.
set -euo pipefail

APP="Idus Hamster Wheel"
ID="se.wolfpack.idushamsterwheel"
REPO="https://github.com/Idus/idus-hamster-wheel"
ZIP_URL="${IDUS_HAMSTER_WHEEL_ZIP:-$REPO/releases/latest/download/$ID.sdPlugin.zip}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)"
RUN_AS_FILE="${BASH_SOURCE[0]:-}"   # empty when piped from curl

# OpenDeck's plugin folder: native package first, then the Flatpak
PLUGINS="$HOME/.config/opendeck/plugins"
FLATPAK_PLUGINS="$HOME/.var/app/me.amankhanna.opendeck/config/opendeck/plugins"
FLATPAK=0
if [ ! -d "$HOME/.config/opendeck" ] && [ -d "$HOME/.var/app/me.amankhanna.opendeck" ]; then
    PLUGINS="$FLATPAK_PLUGINS"; FLATPAK=1
fi
DEST="$PLUGINS/$ID.sdPlugin"

if [ "${1:-}" = "--uninstall" ]; then
    rm -rf "$DEST"
    echo "🗑  $APP removed from $PLUGINS."
    echo "   Quit OpenDeck from its tray icon and start it again."
    exit 0
fi

echo "▶ Installing $APP"

# Node.js 22+ (OpenDeck runs the plugin with the system node; 22 has the WebSocket client it needs)
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed. On Arch/CachyOS: sudo pacman -S nodejs — then run this again."
    exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "❌ Node.js $(node --version) is too old — $APP needs 22 or newer."
    exit 1
fi
echo "   ✓ Node.js $(node --version)"

if [ ! -d "$(dirname "$PLUGINS")" ]; then
    echo "⚠️  OpenDeck's config folder was not found. Start OpenDeck once, then run this again."
    exit 1
fi

# Plugin files: next to this script (git clone), the release zip next to this script
# (downloaded release files, e.g. by Idus GitHub Updater) or the latest release
TMP=""
if [ -f "$SRC/$ID.sdPlugin/manifest.json" ]; then
    FROM="$SRC/$ID.sdPlugin"
else
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    if [ -n "$RUN_AS_FILE" ] && [ -z "${IDUS_HAMSTER_WHEEL_ZIP:-}" ] && [ -f "$SRC/$ID.sdPlugin.zip" ]; then
        echo "   using $ID.sdPlugin.zip next to this script"
        cp "$SRC/$ID.sdPlugin.zip" "$TMP/plugin.zip"
    else
        echo "   downloading the latest release…"
        curl -fsSL --max-time 120 -o "$TMP/plugin.zip" "$ZIP_URL"
    fi
    if command -v unzip >/dev/null 2>&1; then unzip -q "$TMP/plugin.zip" -d "$TMP"
    else python3 -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$TMP/plugin.zip" "$TMP"; fi
    FROM="$TMP/$ID.sdPlugin"
    [ -f "$FROM/manifest.json" ] || { echo "❌ The download did not contain $ID.sdPlugin"; exit 1; }
fi

mkdir -p "$PLUGINS"
rm -rf "$DEST"
cp -r "$FROM" "$DEST"
echo "   ✓ plugin → $DEST"

# Fonts for the Idus look on the key: Saira, IBM Plex Sans, JetBrains Mono (shared with the other
# Idus apps). User-level, from Google Fonts' GitHub (SIL Open Font License); skipped when already
# installed; a failed download is not fatal.
FONTS="$HOME/.local/share/fonts/idus"
GF="https://raw.githubusercontent.com/google/fonts/main/ofl"
FONT_NEW=0
fetch_font() {  # $1 family  $2 path under ofl/  $3 local file name
    fc-list : family 2>/dev/null | grep -qi "^$1" && return 0
    mkdir -p "$FONTS"
    if curl -fsSL --max-time 60 -o "$FONTS/$3" "$GF/$2"; then
        echo "   + font: $1"; FONT_NEW=1
    else
        rm -f "$FONTS/$3"; echo "⚠️  could not download the $1 font — the key falls back to a system font."
    fi
}
if command -v curl >/dev/null 2>&1 && command -v fc-list >/dev/null 2>&1; then
    fetch_font "Saira" "saira/Saira%5Bwdth,wght%5D.ttf" "Saira[wdth,wght].ttf"
    fetch_font "IBM Plex Sans" "ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf" "IBMPlexSans[wdth,wght].ttf"
    fetch_font "JetBrains Mono" "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf" "JetBrainsMono[wght].ttf"
    if [ "$FONT_NEW" = 1 ]; then fc-cache -f "$FONTS" >/dev/null 2>&1 || true; fi
fi

# What the wheel can do on this computer (nothing is changed here — only checked)
echo
echo "   Checks:"
if command -v kde-inhibit >/dev/null 2>&1; then echo "   ✓ stay awake: kde-inhibit"
elif command -v systemd-inhibit >/dev/null 2>&1; then echo "   ✓ stay awake: systemd-inhibit"
else echo "   ⚠️  no kde-inhibit or systemd-inhibit — the screen may still lock (the mouse moves still work)"; fi
if ! command -v python3 >/dev/null 2>&1; then
    echo "   ⚠️  python3 is missing — the mouse cannot be moved (sudo pacman -S --needed python)"
elif [ ! -e /dev/uinput ]; then
    echo "   ⚠️  no /dev/uinput — load it with: sudo modprobe uinput"
elif [ ! -w /dev/uinput ]; then
    echo "   ⚠️  your user may not write /dev/uinput — the key's settings panel shows a one-line fix"
else
    echo "   ✓ mouse: /dev/uinput"
fi
if command -v gdbus >/dev/null 2>&1; then echo "   ✓ notification: gdbus"
else echo "   ⚠️  gdbus is missing — no notification while it runs"; fi
if [ "$FLATPAK" = 1 ]; then
    echo "   ℹ️  OpenDeck is a Flatpak: if the checks fail inside it, see the README (Flatpak)."
fi

VER="$(sed -n 's/.*"Version": *"\([^"]*\)".*/\1/p' "$DEST/manifest.json" | head -1)"
echo
echo "✅ $APP v$VER installed."
echo "   Quit OpenDeck from its tray icon (not just the window) and start it again."
echo "   The key is under \"Idus Hamster Wheel\" in OpenDeck's action list: BRB · Hamster Wheel."
