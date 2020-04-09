import Benchmark from 'benchmark';
import {
    AddBotAction,
    botAdded,
    createBot,
    Bot,
    calculateActionResults,
    BotsState,
    action,
} from '../bots';

let runtimeSuite = new Benchmark.Suite('OldRuntime: 10 bots');

runtimeSuite.add('run 1000 shouts', async function() {
    const state = {} as BotsState;
    for (let i = 0; i < 10; i++) {
        const id = `bot${i}`;
        state[id] = createBot(id, {
            test: '@player.toast("hello")',
        });
    }

    for (let i = 0; i < 1000; i++) {
        calculateActionResults(state, action('test'));
    }
});

export default [runtimeSuite];
