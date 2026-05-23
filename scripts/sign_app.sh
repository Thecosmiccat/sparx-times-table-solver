#!/usr/bin/env bash
# Ad-hoc sign a .app so macOS does not report it as "damaged".
set -euo pipefail

APP="${1:?Usage: sign_app.sh /path/to/App.app}"
IDENTITY="${CODESIGN_IDENTITY:--}"

if [[ ! -d "$APP" ]]; then
  echo "Not found: $APP" >&2
  exit 1
fi

CLEAN="/tmp/sparx-sign-$$.app"
rm -rf "$CLEAN"
ditto "$APP" "$CLEAN"
xattr -cr "$CLEAN"
find "$CLEAN" -name '.DS_Store' -delete 2>/dev/null || true
find "$CLEAN" -name '._*' -delete 2>/dev/null || true

# Sign libraries first, then the bundle (avoids broken sealed resources)
while IFS= read -r -d '' lib; do
  codesign --force --sign "$IDENTITY" "$lib"
done < <(find "$CLEAN/Contents" -type f \( -name '*.dylib' -o -name '*.so' \) -print0 2>/dev/null)

codesign --force --deep --sign "$IDENTITY" "$CLEAN"
codesign --verify --deep "$CLEAN"

rm -rf "$APP"
ditto "$CLEAN" "$APP"
rm -rf "$CLEAN"
xattr -cr "$APP"
echo "Signed: $APP"
