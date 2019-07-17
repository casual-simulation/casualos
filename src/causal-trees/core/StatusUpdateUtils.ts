import { ProgressMessage, StatusUpdate } from './StatusUpdate';

export function remapProgressPercent(
    start: number,
    end: number
): (message: StatusUpdate) => StatusUpdate {
    let ratio = end - start;
    return (msg: StatusUpdate) => {
        if (msg.type !== 'progress') {
            return msg;
        }

        let realProgress = start + ratio * msg.progress;
        return {
            ...msg,
            progress: realProgress,
        };
    };
}
