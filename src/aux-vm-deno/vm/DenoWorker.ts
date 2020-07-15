export interface WebpackWorker {
    new (): Worker;
}
const w: WebpackWorker = require('worker-loader?inline=true!./DenoAuxChannel.worker');

export default w;
