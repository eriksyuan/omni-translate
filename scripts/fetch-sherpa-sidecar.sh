#!/usr/bin/env bash
# Downloads sherpa-onnx sidecar (macOS universal2) into src-tauri/binaries/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/binaries"
CACHE="${TMPDIR:-/tmp}/omnitranslate-sherpa-sidecar"
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.3/sherpa-onnx-v1.13.3-osx-universal2-shared-no-tts.tar.bz2"
SHA256="d01e2bb576c8c7e6124c5866040ab51f372d35b98114a6f2c97354eaf4f8db03"

mkdir -p "$CACHE" "$DEST/lib"
ARCHIVE="$CACHE/sidecar.tar.bz2"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Downloading sherpa sidecar..."
  curl -L --fail -o "$ARCHIVE" "$URL"
fi

echo "$SHA256  $ARCHIVE" | shasum -a 256 -c -

EXTRACTED="$CACHE/sherpa-onnx-v1.13.3-osx-universal2-shared-no-tts"
if [[ ! -d "$EXTRACTED" ]]; then
  tar xjf "$ARCHIVE" -C "$CACHE"
fi

cp "$EXTRACTED/bin/sherpa-onnx-online-websocket-server" "$DEST/"
cp "$EXTRACTED/lib/"*.dylib "$DEST/lib/" 2>/dev/null || cp -R "$EXTRACTED/lib/." "$DEST/lib/"
chmod +x "$DEST/sherpa-onnx-online-websocket-server"

# Tauri externalBin expects a target-triple suffix at build time.
for triple in aarch64-apple-darwin x86_64-apple-darwin; do
  cp "$DEST/sherpa-onnx-online-websocket-server" "$DEST/sherpa-onnx-online-websocket-server-$triple"
done

echo "Sidecar ready at $DEST"
