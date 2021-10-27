const childProcess = require('child_process');

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();
const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

module.exports = {
    GIT_TAG: latestTag,
    GIT_HASH: commitHash,
};
