import fs from 'fs/promises';
import path from 'path';
import rootPath from './root-path.cjs';

const dependencyGraphPath = path.resolve(
    rootPath,
    './src/aux-server/aux-web/dist/dependency-graph.json'
);
const fileToFind = process.argv[2];

async function work() {
    const json = await fs.readFile(dependencyGraphPath, 'utf8');
    const contents = JSON.parse(json);

    console.log('Loaded contents');

    // let path = [];

    let map = new Map();

    for (let entry of contents) {
        map.set(entry.target, entry.source);
    }

    console.log('calculated map');
    console.log('finding file', fileToFind);

    let path = [];
    let includedFiles = new Set();
    let currentTarget = fileToFind;
    while (true) {
        path.push(currentTarget);
        const nextSource = map.get(currentTarget);
        if (!nextSource || includedFiles.has(nextSource)) {
            break;
        }

        includedFiles.add(nextSource);
        currentTarget = nextSource;
    }

    for (let i = path.length - 1; i >= 0; i--) {
        console.log(path[i]);
    }
}

work();
