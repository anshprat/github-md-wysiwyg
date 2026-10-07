#!/bin/bash
# Renders icons/src/*.svg into the PNG sizes the manifest uses.
# Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick).
set -e
cd "$(dirname "$0")/.."

rsvg-convert -w 16 -h 16 icons/src/icon-small.svg -o icons/icon16.png
rsvg-convert -w 32 -h 32 icons/src/icon-small.svg -o icons/icon32.png
# 48: 2 px transparent margin. 128: 96 px artwork + 16 px margin (Chrome Web Store guideline).
rsvg-convert -w 44 -h 44 icons/src/icon.svg | magick - -background none -gravity center -extent 48x48 icons/icon48.png
rsvg-convert -w 96 -h 96 icons/src/icon.svg | magick - -background none -gravity center -extent 128x128 icons/icon128.png

file icons/*.png
