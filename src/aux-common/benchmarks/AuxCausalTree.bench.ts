import Benchmark from 'benchmark';
import { AuxCausalTree } from '../aux-format';
import { Bot, createFile, BotAction, fileAdded } from '../Files';
import { storedTree, site } from '@casual-simulation/causal-trees';

let addFileSuite = new Benchmark.Suite('AuxCausalTree#addFile');

let tree: AuxCausalTree;
let files: Bot[];

addFileSuite.add(
    'add 1 file',
    async function(deferred: any) {
        await tree.root();

        for (let file of files) {
            await tree.addFile(file);
        }

        deferred.resolve();
    },
    {
        defer: true,
        setup: () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            files = [];
            for (let i = 0; i < 1; i++) {
                files.push(
                    createFile(undefined, {
                        test: true,
                        tag2: 123,
                        tag3: false,
                        tag4: 'a long string',
                    })
                );
            }
        },
    }
);

addFileSuite.add(
    'add 1000 files',
    async function(deferred: any) {
        await tree.root();

        for (let file of files) {
            await tree.addFile(file);
        }

        deferred.resolve();
    },
    {
        defer: true,
        setup: () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            files = [];
            for (let i = 0; i < 1000; i++) {
                files.push(
                    createFile(undefined, {
                        test: true,
                        tag2: 123,
                        tag3: false,
                        tag4: 'a long string',
                    })
                );
            }
        },
    }
);

let addEventsSuite = new Benchmark.Suite('AuxCausalTree#addEvents');
let events: BotAction[];

addEventsSuite.add(
    'add 1000 files',
    async function(deferred: any) {
        await tree.root();

        await tree.addEvents(events);

        deferred.resolve();
    },
    {
        defer: true,
        setup: () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            events = [];
            for (let i = 0; i < 1000; i++) {
                events.push(
                    fileAdded(
                        createFile(undefined, {
                            test: true,
                            tag2: 123,
                            tag3: false,
                            tag4: 'a long string',
                        })
                    )
                );
            }
        },
    }
);

export default [addFileSuite, addEventsSuite];
