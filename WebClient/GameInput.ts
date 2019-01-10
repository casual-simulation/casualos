import { Event } from '../common/Event';

export class GameInput {
    private _initialized: boolean;

    public init() {
        if (this._initialized)
            return;

        console.log("[GameInput] Initialize");
        this._initialized = true;
    }
}

export const gameInput = new GameInput();