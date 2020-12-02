const tar = require('tar');
const fs = require('fs');
const path = require('path');

const outputFolder = './temp';
const output = path.join(outputFolder, 'output.tar.gz');
const inputs = [
    './src/aux-server/package.json',
    './src/aux-server/package-lock.json',
    './src/aux-server/package.json',
    './src/aux-server/server/dist',
    './src/aux-server/aux-web/dist',
    './Dockerfile.arm32',
];

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(outputFolder, { recursive: true }, (err) => {
    if (err) throw err;

    tar.c(
        {
            gzip: true,
        },
        inputs
    ).pipe(fs.createWriteStream(output));
});
