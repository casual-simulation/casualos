
/**
 * Defines an array that wraps part another array.
 */
export class VirtualArray<T> {

    private _array: T[];
    private _start: number;
    private _end: number;
    
    get start() {
        return this._start;
    }

    get end() {
        return this._end;
    }

    /**
     * Gets the length of the virtual array.
     */
    get length() {
        return this._end - this._start;
    }

    /**
     * Creates a new virtual array that wraps over the given array from the start index to the end index.
     * @param array 
     * @param start 
     * @param end 
     */
    constructor(array: T[], start: number, end?: number) {
        this._array = array;
        this._start = start || 0;
        this._end = typeof end === 'undefined' ? this._array.length : (end || 0);
    }

    /**
     * Gets the value at the given index.
     * @param index The index.
     */
    get(index: number) {
        if (index < 0 || index >= this.length) {
            throw VirtualArray._indexOutOfRange();
        }
        const final = this._start + index;
        return this._array[final];
    }

    /**
     * Sets the value at the given index.
     * @param index 
     * @param value 
     */
    set(index: number, value: T) {
        if (index < 0) {
            throw VirtualArray._indexOutOfRange();
        }

        if (index >= this.length) {
            const newElements = index - (this.length - 1);
            this._array.splice(this.end, 0, ...(new Array<T>(newElements)));
            this._end = this.end + newElements;
        }
        const final = this._start + index;
        this._array[final] = value;
    }

    /**
     * Adds the given value at the given index in the array.
     * @param index The index.
     * @param value The value.
     */
    insert(index: number, value: T) {
        if (index < 0 || index > this.length) {
            throw VirtualArray._indexOutOfRange();
        }
        const final = this._start + index;
        this._array.splice(final, 0, value);
        this._end++;
    }

    /**
     * Removes the item from the given index.
     * @param index The index.
     */
    remove(index: number) {
        if (index < 0 || index >= this.length) {
            throw VirtualArray._indexOutOfRange();
        }
        const final = this._start + index;
        const val = this._array.splice(final, 1)[0];
        this._end--;
        return val;
    }

    private static _indexOutOfRange() {
        return new Error('Index out of range');
    }
}