#!/bin/sh
# Copy dist/index.html to dist/404.html so the static host serves the SPA
# for all unknown paths (handles /test-login, /view/:slug, etc.)
cp dist/index.html dist/404.html
echo "✓ Copied dist/index.html → dist/404.html"
