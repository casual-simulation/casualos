import childProcess from 'child_process';

const commitHash = childProcess
    .execSync('git rev-parse HEAD')
    .toString()
    .trim();
const latestTag = childProcess
    .execSync('git describe --abbrev=0 --tags')
    .toString()
    .trim();

export const GIT_TAG = latestTag;
export const GIT_HASH = commitHash;
