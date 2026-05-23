#!/bin/bash
cd "$(dirname "$0")"
APP="Sparx Solver Pro.app"
xattr -cr "$APP" 2>/dev/null
xattr -dr com.apple.quarantine "$APP" 2>/dev/null
open "$APP"
