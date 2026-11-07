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
import { RenderRequests } from './RenderRequests';

/**
 * The number of miliseconds between frames that are rendered while the scene is idle and render on demand is enabled.
 * This ensures that changes that did not request a render still become visible eventually.
 */
export const IDLE_RENDER_INTERVAL_MS = 1000;

/**
 * The fraction of the target frame interval that a frame is allowed to arrive early by.
 * Animation frame timestamps jitter slightly, so frames that arrive just before the target interval should still be processed.
 */
const FRAME_INTERVAL_TOLERANCE = 0.1;

/**
 * The relative tolerance that is used when comparing matrices for changes.
 * Camera controls recalculate the camera transform every frame, which introduces tiny floating point differences
 * that should not count as changes.
 */
const MATRIX_CHANGE_TOLERANCE = 1e-9;

/**
 * Determines whether the given lists of matrix elements are equal, ignoring floating point error.
 * NaN values are considered equal to each other.
 * @param first The first list of elements.
 * @param second The second list of elements.
 */
export function matrixElementsNearlyEqual(
    first: ArrayLike<number>,
    second: ArrayLike<number>
): boolean {
    if (first.length !== second.length) {
        return false;
    }
    for (let i = 0; i < first.length; i++) {
        const a = first[i];
        const b = second[i];
        if (a === b || (Number.isNaN(a) && Number.isNaN(b))) {
            continue;
        }
        const scale = Math.max(1, Math.abs(a), Math.abs(b));
        if (!(Math.abs(a - b) <= MATRIX_CHANGE_TOLERANCE * scale)) {
            return false;
        }
    }
    return true;
}

export interface FrameSchedulerOptions {
    /**
     * Whether frames should only be rendered when something has changed.
     */
    renderOnDemand: boolean;

    /**
     * The maximum number of frames per second that should be processed.
     * Null or 0 if the frame rate should not be limited.
     */
    maxFrameRate: number | null;
}

/**
 * Decides which animation frames should be processed and rendered.
 */
export class FrameScheduler {
    private _renderOnDemand: boolean;
    private _maxFrameRate: number = null;
    private _frameInterval: number = 0;
    private _nextFrameTime: number = null;
    private _lastRenderTime: number = null;

    /**
     * Whether frames should only be rendered when something has changed.
     */
    get renderOnDemand() {
        return this._renderOnDemand;
    }

    constructor(options: FrameSchedulerOptions) {
        this._renderOnDemand = options.renderOnDemand;
        this.maxFrameRate = options.maxFrameRate;
    }

    /**
     * The maximum number of frames per second that should be processed.
     * Null or 0 if the frame rate should not be limited.
     */
    get maxFrameRate(): number | null {
        return this._maxFrameRate;
    }

    set maxFrameRate(value: number | null) {
        if (value === this._maxFrameRate) {
            return;
        }
        this._maxFrameRate = value;
        this._frameInterval = value > 0 ? 1000 / value : 0;
        this._nextFrameTime = null;
    }

    /**
     * Determines whether the animation frame at the given time should be processed.
     * Frames are skipped when they would exceed the maximum frame rate.
     * @param time The timestamp of the animation frame in miliseconds.
     * @param immersive Whether the frame is for an AR or VR session. Immersive frames are never skipped.
     */
    shouldProcessFrame(time: number, immersive: boolean): boolean {
        if (immersive || this._frameInterval <= 0) {
            this._nextFrameTime = null;
            return true;
        }

        if (
            this._nextFrameTime !== null &&
            time <
                this._nextFrameTime -
                    this._frameInterval * FRAME_INTERVAL_TOLERANCE
        ) {
            return false;
        }

        // Schedule frames at fixed intervals so that the average frame rate
        // matches the maximum frame rate even when the display refresh rate is not a multiple of it.
        // If we have fallen behind (e.g. the tab was hidden), then start a new schedule from this frame.
        if (
            this._nextFrameTime === null ||
            time - this._nextFrameTime >= this._frameInterval
        ) {
            this._nextFrameTime = time + this._frameInterval;
        } else {
            this._nextFrameTime += this._frameInterval;
        }
        return true;
    }

    /**
     * Determines whether the scene should be rendered for the frame at the given time.
     * @param time The timestamp of the animation frame in miliseconds.
     * @param forceRender Whether the frame must be rendered regardless of whether a render was requested.
     */
    shouldRender(time: number, forceRender: boolean): boolean {
        if (
            !this._renderOnDemand ||
            forceRender ||
            this._lastRenderTime === null ||
            RenderRequests.isRenderRequested(time) ||
            time - this._lastRenderTime >= IDLE_RENDER_INTERVAL_MS
        ) {
            this._lastRenderTime = time;
            return true;
        }
        return false;
    }
}
