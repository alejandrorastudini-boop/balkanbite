#!/usr/bin/env bash
set -euo pipefail
QA_DIR=/tmp/balkanbite-browser-qa
npm install --prefix "$QA_DIR" --no-package-lock --no-audit --no-fund playwright-core@1.63.0 @sparticuz/chromium@153.0.0
QA_BROWSER_MODULES="$QA_DIR" node tests/browser/central-loop.mjs
