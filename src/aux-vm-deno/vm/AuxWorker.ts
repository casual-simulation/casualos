export interface WebpackWorker {
    new (): Worker;
}
const w: WebpackWorker = require('worker-loader?inline=true!./AuxChannel.worker');

export default w;
