CURRENT_VERSION_MARKUP=`awk '
    BEGIN {f=0}
    /^\#\# V/{f+=1}
    f == 1 { print };
    # /^\#\#\#\ Changes:/{f=1}
' CHANGELOG.md`

# echo "${CURRENT_VERSION_MARKUP}"

CURRENT_VERSION_NOTES=$(echo "${CURRENT_VERSION_MARKUP}" | awk '
    BEGIN {f=0}
    /^\#\#\#\ Changes:/{f+=1}
    f == 1 { print };
')

printf "${CURRENT_VERSION_NOTES}"
