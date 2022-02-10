export class StateMachine {
    public readonly name: string;

    /**
     * Debug level of this state machine.
     * 0 = off; 1 = enter, exit; 2 = transitions, 3 = update
     */
    public debugLevel: number = 0;

    /**
     * Map of available states. state id -> State.
     */
    private _states: {
        [id: string]: State;
    } = {};

    /**
     * Map of transition hash code -> state id
     */
    private _transitions: {
        [transitionHash: number]: string;
    } = {};

    /**
     * The currently active state's id.
     */
    private _curStateId: string;

    /**
     * The state id to change to next.
     */
    private _changeStateId: string;

    private _curFrame: number;
    private _lastUpdateFrame: number;
    private _active: boolean;

    get currentState(): State {
        return this._states[this._curStateId];
    }

    /**
     * Create a new state machine. Setup the state machine using `addState` and `addStateTransition`.
     * Start the state machine using the `start` method. Manually call `update` every frame in order to update the state machine.
     */
    constructor(name: string) {
        this.name = name;
    }

    public start(startingStateId: string, curFrame: number): void {
        if (this._active) return;
        this._active = true;

        this._curFrame = curFrame;
        this._changeState(startingStateId);
        this.update(curFrame);
    }

    public pause(): void {
        if (!this._active) return;
        this._active = false;
    }

    public resume(curFrame: number): void {
        if (this._active) return;
        this._active = true;

        this._curFrame = curFrame;
        this.update(curFrame);
    }

    public addState(state: State): void {
        if (this._active)
            throw new Error(
                'Cannot add states to state machine after it has started.'
            );

        this._states[state.id] = state;
    }

    public addStateTransition(
        transition: Transition,
        nextStateId: string
    ): void {
        if (this._active)
            throw new Error(
                'Cannot add state transitions after the state machine has been started.'
            );
        if (!this._states[nextStateId])
            throw new Error(
                `Can't add transition for state '${nextStateId}'. This state does not exist on the state machine.`
            );

        let transitionHash = computeTransitionHash(transition);
        this._transitions[transitionHash] = nextStateId;
    }

    public getState(stateId: string): State {
        return this._states[stateId];
    }

    public update(curFrame: number): void {
        if (!this._active) return;
        if (this._lastUpdateFrame === curFrame) return;

        this._curFrame = curFrame;
        this._lastUpdateFrame = curFrame;

        if (this._changeStateId) {
            let curState = this._states[this._curStateId];
            if (curState) {
                if (this.debugLevel >= 1)
                    console.log(
                        `${this.toString()} ${
                            curState.id
                        } onStateExit. frame: ${curFrame}`
                    );
                curState.onStateExit();
            }

            curState = this._states[this._changeStateId];
            if (curState) {
                if (this.debugLevel >= 1)
                    console.log(
                        `${this.toString()} ${
                            curState.id
                        } onStateEnter. frame: ${curFrame}`
                    );
                curState.onStateEnter();
            }
        } else {
            throw new Error(
                `${this.toString()} No state with id '${
                    this._changeStateId
                }' found.`
            );
        }

        let curState = this._states[this._curStateId];
        if (curState) {
            if (this.debugLevel >= 3)
                console.log(
                    `${this.toString()} ${
                        curState.id
                    } onStateUpdate. frame: ${curFrame}`
                );

            let command = curState.onStateUpdate();
            if (command) {
                if (this.debugLevel >= 2)
                    console.log(
                        `${this.toString()} ${
                            curState.id
                        } command: ${command}, nextState: ${this.getNextStateId(
                            command
                        )}, frame: ${curFrame}`
                    );
                this._changeState(this.getNextStateId(command));
            }
        }

        this._changeStateId = undefined;
    }

    public toString(): string {
        return `[StateMachine::${this.name}]`;
    }

    /**
     * Call this when getting rid of the state machine.
     */
    public dispose(): void {
        throw new Error("StateMachine's dispose is not implemented yet.");
    }

    /**
     * Usually this state machine should be controlled with state transitions, but in some cases we may want to force a state change.
     */
    public forceChangeState(stateId: string): void {
        this._changeState(stateId);
    }

    private _changeState(stateId: string): void {
        this._changeStateId = stateId;

        // Set the last update frame to an invalid number so that the update state function is forced to run.
        this._lastUpdateFrame = -1;

        // Run the update state function immediately to respond to change the state in the same frame.
        this.update(this._curFrame);
    }

    private getNextStateId(command: string): string {
        if (this._transitions) return;

        let transition: Transition = {
            stateId: this._curStateId,
            command: command,
        };
        let transitionHash = computeTransitionHash(transition);
        let nextStateId = this._transitions[transitionHash];

        if (!nextStateId)
            throw new Error(
                `No transition found for State '${this._curStateId}' with command '${command}'`
            );
        return nextStateId;
    }
}

export abstract class State {
    private _id: string;

    get id(): string {
        return this._id;
    }

    constructor(id: string) {
        this._id = id;
    }

    public abstract onStateEnter(): void;
    public abstract onStateUpdate(): string;
    public abstract onStateExit(): void;
}

interface Transition {
    stateId: string;
    command: string;
}

/**
 * Compute a hash code for the specified Transition.
 * @param transition The transition to compute hash code for.
 */
function computeTransitionHash(transition: Transition): number {
    let hashCode = (s: string) => {
        let h = 0,
            l = s.length,
            i = 0;
        if (l > 0) {
            while (i < l) {
                h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
            }
        }

        return h;
    };

    return (
        17 +
        31 * hashCode(transition.stateId) +
        31 * hashCode(transition.command)
    );
}
