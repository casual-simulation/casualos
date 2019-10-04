import Benchmark from 'benchmark';
import { AuxCausalTree } from '../aux-format';
import { Bot, createBot, BotAction, botAdded } from '../bots';
import { storedTree, site } from '@casual-simulation/causal-trees';

let addBotSuite = new Benchmark.Suite('AuxCausalTree#addBot');

let tree: AuxCausalTree;
let bots: Bot[];

addBotSuite.add(
    'add 1 bot',
    async function(deferred: any) {
        await tree.root();

        for (let bot of bots) {
            await tree.addBot(bot);
        }

        deferred.resolve();
    },
    {
        defer: true,
        setup: () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            bots = [];
            for (let i = 0; i < 1; i++) {
                bots.push(
                    createBot(undefined, {
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

addBotSuite.add(
    'add 1000 bots',
    async function(deferred: any) {
        await tree.root();

        for (let bot of bots) {
            await tree.addBot(bot);
        }

        deferred.resolve();
    },
    {
        defer: true,
        setup: () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            bots = [];
            for (let i = 0; i < 1000; i++) {
                bots.push(
                    createBot(undefined, {
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
    'add 1000 bots',
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
                    botAdded(
                        createBot(undefined, {
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

export default [addBotSuite, addEventsSuite];
