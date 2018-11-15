
import * as git from 'isomorphic-git';
import * as BrowserFS from 'browserfs';
import * as pify from 'pify';
import { FSModule } from 'browserfs/dist/node/core/FS';
import { polyfill } from 'es6-promise';

// Setup the Promise shim for browsers that don't support promises.
polyfill();

let fs: FSModule;
let pfs: any;

async function exists(path: string) {
    try {
        return await pfs.exists(path);
    } catch(ex) {
        return ex;
    }
}

async function start() {

    console.log("Start!");

    let fsOptions = {
        fs: 'IndexedDB',
        options: {}
    };

    let configureAsync = pify(BrowserFS.configure);

    await configureAsync(fsOptions);
    fs = BrowserFS.BFSRequire('fs');

    // Initialize isomorphic-git with our new file system
    git.plugins.set('fs', fs);

    pfs = pify(fs);
    let dir = 'tutorial';

    let dirExists = await exists(dir);

    if (!dirExists) {
        console.log("Cloning...");

        try {
            await git.clone({
                dir,
                corsProxy: 'https://cors.isomorphic-git.org',
                url: 'https://github.com/isomorphic-git/isomorphic-git',
                ref: 'master',
                singleBranch: true,
                depth: 10
            });
            console.log("Cloned!");
        } catch (ex) {
            console.error(ex);
        }
    }

    let files = await pfs.readdir(dir);

    console.log(files);
}

start();
