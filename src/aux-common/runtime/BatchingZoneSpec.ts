import 'zone.js';

/**
 * Defines a zone specification that triggers a callback to flush some buffer
 * once all the micro tasks have finished.
 */
export class BatchingZoneSpec implements ZoneSpec {
    name: string;

    private _hasTask: boolean = false;
    private _hasMicroTask: boolean;
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

    onHasTask(
        parentZoneDelegate: ZoneDelegate,
        currentZone: Zone,
        targetZone: Zone,
        hasTaskState: HasTaskState
    ) {
        if (this._flushing) {
            return;
        }
        const hadTask = this._hasTask;
        this._hasTask = hasTaskState.microTask || hasTaskState.macroTask;
        this._hasMicroTask = hasTaskState.microTask;
        if (hadTask && hadTask !== this._hasTask) {
            this._flush();
        }
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
            if (
                !this._hasMicroTask &&
                this._invokeCount === 0 &&
                !this._flushing
            ) {
                this._flush();
            }
        }
    }
}
