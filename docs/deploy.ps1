param (
    [string]$UserName
)

$env:GIT_USER = $UserName
$env:USE_SSH = "true"

yarn deploy