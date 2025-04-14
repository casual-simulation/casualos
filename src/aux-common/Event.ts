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

/**
 * Event that has no arguments.
 */
export class Event {
    private _listeners: EventListener[] = [];

    public addListener(listener: EventListener) {
        this._listeners.push(listener);
    }

    public removeListener(listener: EventListener) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }

    public removeAllListeners() {
        this._listeners = [];
    }

    public invoke() {
        this._listeners.forEach((l) => {
            l();
        });
    }
}

/**
 * Signature of event listener that has no arguments.
 */
declare type EventListener = () => void;

/**
 * Event that takes typed argument.
 */
export class ArgEvent<T> {
    private _listeners: ArgEventListener<T>[] = [];

    public addListener(listener: ArgEventListener<T>) {
        this._listeners.push(listener);
    }

    public removeListener(listener: ArgEventListener<T>) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }

    public removeAllListeners() {
        this._listeners = [];
    }

    public invoke(arg: T) {
        this._listeners.forEach((l) => {
            l(arg);
        });
    }
}

/**
 * Signature of event listener that accepts typed argument.
 */
declare type ArgEventListener<T> = (arg: T) => void;
