#!/usr/bin/env bash
set -euo pipefail

# Copy Handsfree.js library + model assets out of node_modules into
# ./public/ so the page is fully self-hosted (no Unpkg / CDN at runtime).

src="node_modules/handsfree/build/lib"
dst="public"

if [ ! -d "$src" ]; then
  echo "error: $src not found. Run 'npm install' first." >&2
  exit 1
fi

mkdir -p "$dst/assets"
cp "$src/handsfree.js" "$dst/handsfree.js"
cp -R "$src/assets/." "$dst/assets/"
echo "Ejected handsfree.js and assets to $dst/"
