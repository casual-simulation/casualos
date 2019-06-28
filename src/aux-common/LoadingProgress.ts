import { ArgEvent } from './Events';
import {
    ProgressStatus,
    LoadingProgressCallback,
} from '@casual-simulation/causal-trees';
import { lerp } from './utils';

export class LoadingProgress implements ProgressStatus {
    /**
     * This event is fired any time a value in this loading progress object changes.
     */
    public onChanged: ArgEvent<LoadingProgress> = new ArgEvent<
        LoadingProgress
    >();

    private _show: boolean = true;
    private _progress: number = 0;
    private _status: string = '';
    private _error: string = '';

    constructor() {}

    /**
     * Should a loading progress screen be shown?
     */
    get show(): boolean {
        return this._show;
    }
    set show(val: boolean) {
        this._show = val;
        this._emitChanged();
    }

    /**
     * Current progress of the load (0-100).
     */
    get progress(): number {
        return this._progress;
    }
    set progress(val: number) {
        this._progress = val;
        this._emitChanged();
    }

    /**
     * Current status message of the load.
     */
    get status(): string {
        return this._status;
    }
    set status(val: string) {
        this._status = val;
        this._emitChanged();
    }

    /**
     * Messsage to show when something bad occurs while loading (null for no error).
     */
    get error(): string {
        return this._error;
    }
    set error(val: string) {
        this._error = val;
        this._emitChanged();
    }

    get progressPercent() {
        return this.progress / 100;
    }

    get message() {
        return this.status;
    }

    /**
     * Set all values of loading progress at once. Will emit a single changed event.
     * @param progress Current progress of the load (0-100).
     * @param status Current status message of the load.
     * @param error Messsage to show when something bad occurs while loading. (null for no error)
     */
    set(progress: number, status: string, error: string) {
        this._progress = getOptionalValue(progress, 0);
        this._status = getOptionalValue(status, '');
        this._error = getOptionalValue(error, '');
        this._emitChanged();
    }

    /**
     * Creates a nested @see LoadingProgressCallback that can be used to relay progress from a child component into the parent.
     * @param start The start progress percentage.
     * @param end The end progress percentage.
     */
    createNestedCallback(start: number, end: number): LoadingProgressCallback {
        return (status: ProgressStatus) => {
            let percent = status.progressPercent
                ? lerp(start, end, status.progressPercent)
                : this.progress;
            let message = status.message ? status.message : this.status;
            let error = status.error ? status.error : this.error;

            this.set(percent, message, error);
        };
    }

    /**
     * Clone this object and all its current data.
     */
    clone(): LoadingProgress {
        let clone = new LoadingProgress();
        clone._show = this._show;
        clone._progress = this._progress;
        clone._status = this._status;
        clone._error = this._error;
        return clone;
    }

    private _emitChanged() {
        this.onChanged.invoke(this);
    }
}

function getOptionalValue(obj: any, defaultValue: any): any {
    return obj !== undefined && obj !== null ? obj : defaultValue;
}
