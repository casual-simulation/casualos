export interface WebpackWorker {
    new (): Worker;
}
// // const w = new Worker(new URL('./AuxChannel.worker', import.meta.url)
const w: WebpackWorker = require('./AuxChannel.worker').default;

export default w;
