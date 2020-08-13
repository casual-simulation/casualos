CURRENT_VERSION_MARKUP=`awk '
    BEGIN {f=0}
    /^\#\# V/{f+=1}
    f == 1 { print };
' CHANGELOG.md`

CURRENT_VERSION=$(echo "${CURRENT_VERSION_MARKUP}" | awk '/\#\# V/ {print $2}' | cut -c 2-10000)

echo "${CURRENT_VERSION}"
