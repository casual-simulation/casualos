import Benchmark from 'benchmark';
import { AuxRuntime } from '../runtime';
import { AddBotAction, botAdded, createBot, Bot } from '../bots';

let runtimeSuite = new Benchmark.Suite('AuxRuntime: 10 bots');

runtimeSuite.add('run 1000 shouts', async function() {
    const runtime = new AuxRuntime(null, null);

    const bots = [] as Bot[];
    for (let i = 0; i < 10; i++) {
        bots.push(
            createBot(`bot${i}`, {
                test: '@player.toast("hello")',
            })
        );
    }

    runtime.botsAdded(bots);

    for (let i = 0; i < 1000; i++) {
        runtime.shout('test');
    }
});

export default [runtimeSuite];
