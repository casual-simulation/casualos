
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
    let dir = 'test-project';

    let dirExists = await exists(dir);

    if (!dirExists) {
        console.log("Cloning...");

        try {
            await git.clone({
                dir,
                url: 'http://localhost:3000/git/root/test-project.git',
                ref: 'master'
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
