
/**
 * Defines a class that is able to handle recognizing tap codes.
 */
export class TapCodeManager {    
    private _code: string;
    private _max: number;

    /**
     * Gets the code that the manager has built.
     */
    get code(): string {
        return this._code;
    }

    /**
     * Creates a new tap code manager.
     */
    constructor() {
        this._code = '';
        this._max = -1;
    }

    /**
     * Resets the tap code.
     */
    reset() {
        this._code = '';
        this._max = -1;
    }

    /**
     * Records the number of touches for the frame.
     * @param num The number.
     */
    recordTouches(num: number) {
        if (this._max > 0) {
            if (num > 0) {
                this._max = Math.max(num, this._max);
            } else {
                this._code += this._max;
                this._max = 0;
            }
        } else if (num > 0) {
            this._max = num;
        }
    }

    /**
     * Trims the code to the given length.
     * @param length The length.
     */
    trim(length: number) {
        if (this.code.length > length) {
            this._code = this.code.substring(this.code.length - length);
        }
    }
}