#!/bin/bash

set -e

# Step 1: Checkout develop
git checkout develop

# Step 2: Replace "TBD" with the current date
CURRENT_DATE="$(date +%-m\/%-d\/%Y)"
sed -i '' -e "s!### Date: TBD!### Date: ${CURRENT_DATE}!g" ./CHANGELOG.md

# Step 3: Commit Change
git add CHANGELOG.md
git commit -m "chore: Update CHANGELOG Date"

# 4. Merge develop into master
git checkout master
git fetch origin
git reset origin/master --hard
git merge develop --no-ff

# 5. Run `lerna version` specify patch
lerna version patch --yes