const fs = require('fs');
const path = require('path');

const outputFolder = path.resolve(__dirname, '..', './temp');
const output = path.join(outputFolder, 'config.json');

const distFolder = path.resolve(
    __dirname,
    '..',
    './src/aux-server/aux-web/dist/api'
);
const distOutput = path.join(distFolder, 'config');

const webConfig = {
    version: null,
    causalRepoConnectionProtocol:
        process.env.CAUSAL_REPO_CONNECTION_PROTOCOL || 'websocket',
    causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
    sharedPartitionsVersion: process.env.SHARED_PARTITIONS_VERSION || 'v2',
    vmOrigin: process.env.VM_ORIGIN || null,
    authOrigin: process.env.AUTH_ORIGIN || null,
    recordsOrigin: process.env.RECORDS_ORIGIN || null,
    disableCollaboration: process.env.DISABLE_COLLABORATION === 'true',
    ab1BootstrapURL: process.env.AB1_BOOTSTRAP_URL || null,
    arcGisApiKey: process.env.ARC_GIS_API_KEY || null,
    jitsiAppName:
        process.env.JITSI_APP_NAME ||
        'vpaas-magic-cookie-332b53bd630448a18fcb3be9740f2caf',
    what3WordsApiKey: process.env.WHAT_3_WORDS_API_KEY || 'Z0NHMSXQ',
    playerMode: process.env.AUX_PLAYER_MODE,
};

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(outputFolder, { recursive: true }, (err) => {
    if (err) throw err;

    fs.writeFileSync(output, JSON.stringify(webConfig), {
        encoding: 'utf8',
    });
});

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(distFolder, { recursive: true }, (err) => {
    if (err) throw err;

    fs.writeFileSync(distOutput, JSON.stringify(webConfig), {
        encoding: 'utf8',
    });
});
