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

        if (this._timeSinceStart > this._lastFrameRateTime + FRAME_RATE_UPDATE_INTERVAL) {
            this._frameRate = (this._frameCount - this._lastFrameRateCount) / (this._timeSinceStart - this._lastFrameRateTime);
            this._lastFrameRateTime = this._timeSinceStart;
            this._lastFrameRateCount = this._frameCount;
        }
    }
}
