export interface WebpackWorker {
    new (): Worker;
}
// // const w = new Worker(new URL('./AuxChannel.worker', import.meta.url)

// load worker by require().
// For some reason, loading relative imports with worker-loader fails when using the import syntax
// but the require syntax works.
// const w: WebpackWorker = require('./AuxChannel.worker').default;
import w from './AuxChannel.worker?worker';

export default w;
