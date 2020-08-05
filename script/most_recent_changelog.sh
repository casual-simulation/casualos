# Each version in the changelog contains 3 sections:
# 1. The version number
# 2. The release date
# 3. The changes

# Find the markup that includes all 3 sections of
# the most recent release.
# We do this by looking for a line that starts with "## V"
# (which designates the start of a release's notes)
# and grabbing everything until the next "## V"
CURRENT_VERSION_MARKUP=`awk '
    BEGIN {f=0}
    /^\#\# V/{f+=1}
    f == 1 { print };
    # /^\#\#\#\ Changes:/{f=1}
' CHANGELOG.md`

# Find the markup from the current version that only includes the changes.
# We do this by grabbing everything including and after the first two headings that are heading 2 or larger.
# (The version number is heading 2 and the release date is heading 4 but also sometimes heading 3.
#  The changes have their own headings but we don't need to care about them)
CURRENT_VERSION_NOTES=$(echo "${CURRENT_VERSION_MARKUP}" | awk '
    BEGIN {f=0}
    /^\#\#/{f+=1}
    f > 2 { print };
')

printf "${CURRENT_VERSION_NOTES}"
