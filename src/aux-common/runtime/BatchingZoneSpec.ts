import 'zone.js';

/**
 * Defines a zone specification that triggers a callback to flush some buffer
 * once all the micro tasks have finished.
 */
export class BatchingZoneSpec implements ZoneSpec {
    name: string;

    private _flush: () => void;
    private _flushing: boolean = false;

    private _invokeCount: number = 0;

    constructor(flush: () => void) {
        this.name = 'BatchingZone';
        this._flush = () => {
            try {
                this._flushing = true;
                flush();
            } finally {
                this._flushing = false;
            }
        };
    }

    onInvoke(
        parentZoneDelegate: ZoneDelegate,
        currentZone: Zone,
        targetZone: Zone,
        callback: Function,
        applyThis: any,
        applyArgs?: any[],
        source?: string
    ) {
        try {
            this._invokeCount += 1;
            const result = parentZoneDelegate.invoke(
                targetZone,
                callback,
                applyThis,
                applyArgs,
                source
            );
            return result;
        } finally {
            this._invokeCount -= 1;
            if (this._invokeCount === 0 && !this._flushing) {
                this._flush();
            }
        }
    }

    onInvokeTask(
        parentZoneDelegate: ZoneDelegate,
        currentZone: Zone,
        targetZone: Zone,
        task: Task,
        applyThis: any,
        applyArgs?: any[]
    ): any {
        try {
            this._invokeCount += 1;
            const result = parentZoneDelegate.invokeTask(
                targetZone,
                task,
                applyThis,
                applyArgs
            );
            return result;
        } finally {
            this._invokeCount -= 1;
            if (this._invokeCount === 0 && !this._flushing) {
                this._flush();
            }
        }
    }
}
