export interface WebpackWorker {
    new (): Worker;
}
const w: WebpackWorker = require('./AuxChannel.worker');

export default w;
