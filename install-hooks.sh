#!/bin/sh
# Point git at the committed hooks. Run once after cloning.
set -e
git config core.hooksPath .githooks
echo "hooks installed: core.hooksPath -> .githooks"
