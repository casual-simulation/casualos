export interface WebpackWorker {
    new (): Worker;
}
const w: WebpackWorker = require('worker-loader!./AuxChannel.worker');

export default w;
