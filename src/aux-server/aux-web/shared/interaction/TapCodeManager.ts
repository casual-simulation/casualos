/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
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
