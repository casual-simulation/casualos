#!/bin/bash

set -e

# Step 1: Checkout develop
git checkout develop
git reset origin/develop --hard

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
lerna version patch --yes --no-push

# 6. Push to origin with tags
git push origin --follow-tags

# 7. Get latest CHANGELOG
CHANGELOG=$(./script/most_recent_changelog.sh)

GIT_REPO_OWNER="casual-simulation"
GIT_REPO_NAME="aux"
GITHUB_TOKEN="${AUX_RELEASE_TOKEN}"

# 8. Create release on github
node ./script/make-github-release.js release -o "${GIT_REPO_OWNER}" -r "${GIT_REPO_NAME}" -t "${CHANGELOG}" -a "${GITHUB_TOKEN}"