const fs = require('fs');
const path = require('path');

const outputFolder = './temp';
const output = path.join(outputFolder, 'config.json');
const webConfig = {
    sentryDsn: process.env.SENTRY_DSN || null,
    version: null,
    causalRepoConnectionProtocol:
        process.env.CAUSAL_REPO_CONNECTION_PROTOCOL || 'socket.io',
    causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
    sharedPartitionsVersion: process.env.SHARED_PARTITIONS_VERSION ?? 'v1',
    vmOrigin: process.env.VM_ORIGIN || null,
    disableCollaboration: process.env.DISABLE_COLLABORATION === 'true',
};

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(outputFolder, { recursive: true }, (err) => {
    if (err) throw err;

    fs.writeFileSync(output, JSON.stringify(webConfig), {
        encoding: 'utf8',
    });
});
