#!/bin/bash

# Packaging script for Chrome Web Store upload.
# Builds the extension, then creates {extension-name}-v{version}.zip with only
# the files Chrome needs (manifest, icons, built scripts).

set -e

VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
NAME=$(grep -o '"name": "[^"]*"' manifest.json | cut -d'"' -f4 | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
ZIP_NAME="${NAME}-v${VERSION}.zip"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Building ${NAME} v${VERSION}...${NC}"
npm run build --silent

[ -f "$ZIP_NAME" ] && rm "$ZIP_NAME"
zip -r "$ZIP_NAME" manifest.json icons dist -x "*.DS_Store"

echo -e "${GREEN}Package created: ${ZIP_NAME}${NC}"
echo -e "${BLUE}Upload at: https://chrome.google.com/webstore/devconsole${NC}"
