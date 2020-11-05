#!/bin/bash

set -e

TARGET_BRANCH="$1"

# Step 1: Checkout develop
git checkout develop
git reset origin/develop --hard

# Step 2: Replace "TBD" with the current date
CURRENT_DATE="$(date +%-m\/%-d\/%Y)"
sed -i '' -e "s!#### Date: TBD!#### Date: ${CURRENT_DATE}!g" ../CHANGELOG.md

# Step 3: Commit Change
git add CHANGELOG.md
git commit -m "chore: Update CHANGELOG Date"

# 4. Merge develop into the target branch
git checkout "$TARGET_BRANCH"
git fetch origin
git reset "origin/$TARGET_BRANCH" --hard
git merge develop --no-ff

# 5. Get version
VERSION=$(./next_version.sh)

# 6/ Run `lerna version` specify patch
lerna version "$VERSION" --yes --no-push

# 7. Push to origin with tags
git push origin --follow-tags