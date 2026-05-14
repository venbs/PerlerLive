#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [ -f package-lock.json ]; then
  npm ci --legacy-peer-deps
else
  npm install --legacy-peer-deps
fi

npm run build

rm -rf output
mkdir -p output
cp -R dist/. output/
