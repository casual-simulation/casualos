const tar = require('tar');
const fs = require('fs');
const path = require('path');

const outputFolder = './temp';
const output = path.join(outputFolder, 'output-client.tar.gz');
const inputs = fs.readdirSync('./src/aux-server/aux-web/dist');

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(outputFolder, { recursive: true }, (err) => {
    if (err) throw err;

    tar.c(
        {
            gzip: true,
            cwd: './src/aux-server/aux-web/dist',
        },
        inputs
    ).pipe(fs.createWriteStream(output));
});
