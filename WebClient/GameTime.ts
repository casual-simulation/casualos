import { Clock } from 'three';

export class GameTime {
    private _frameCount: number;
    private _timeSinceStart: number;
    private _deltaTime: number;
    private _clock: Clock;

    constructor() {
        this._frameCount = 0;
        this._timeSinceStart = 0;
        this._deltaTime = 0;
        this._clock = new Clock(true);
        
        requestAnimationFrame(() => this.update());
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

    update() {
        // Track time.
        this._frameCount += 1;
        this._deltaTime = this._clock.getDelta();
        this._timeSinceStart += this._deltaTime;

        requestAnimationFrame(() => this.update());
    }
}

export const gameTime = new GameTime();