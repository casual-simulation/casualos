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
import { Clock } from '@casual-simulation/three';

const FRAME_RATE_UPDATE_INTERVAL = 1;

export class Time {
    private _frameCount: number = 0;
    private _timeSinceStart: number = 0;
    private _deltaTime: number = 0;
    private _clock: Clock;

    private _lastFrameRateTime = 0;
    private _lastFrameRateCount = 0;
    private _frameRate: number = 0;

    constructor() {
        this._frameCount = 0;
        this._timeSinceStart = 0;
        this._deltaTime = 0;
        this._frameRate = 0;
        this._lastFrameRateTime = 0;
        this._clock = new Clock(true);
    }

    /**
     * Number of frames that have passed since this game view was created.
     */
    get frameCount(): number {
        return this._frameCount;
    }

    /**
     * Number of seconds that have passed since this game view was created.
     */
    get timeSinceStart(): number {
        return this._timeSinceStart;
    }

    /**
     * Time in seconds that has passed since the last frame.
     */
    get deltaTime(): number {
        return this._deltaTime;
    }

    /**
     * Gets the average number of frames per second over the last second.
     */
    get frameRate(): number {
        return this._frameRate;
    }

    update() {
        // Track time.
        this._frameCount += 1;
        this._deltaTime = this._clock.getDelta();
        this._timeSinceStart += this._deltaTime;

        if (
            this._timeSinceStart >
            this._lastFrameRateTime + FRAME_RATE_UPDATE_INTERVAL
        ) {
            this._frameRate =
                (this._frameCount - this._lastFrameRateCount) /
                (this._timeSinceStart - this._lastFrameRateTime);
            this._lastFrameRateTime = this._timeSinceStart;
            this._lastFrameRateCount = this._frameCount;
        }
    }
}
