export interface WebpackWorker {
    new (): Worker;
}
const w: WebpackWorker = require('worker-loader?inline=fallback!./AuxChannel.worker')
    .default;

export default w;
