import {
    Agent,
    ManagedRealm,
    setSurroundingAgent,
} from '@casual-simulation/engine262';

/**
 * Defines a class that wraps common engine262 capabilities.
 */
export class Interpreter {
    /**
     * The agent that this interpreter is currently using.
     */
    agent: Agent;

    /**
     * The realm that this interpreter is using.
     */
    realm: ManagedRealm;

    constructor() {
        this.agent = new Agent({});
        setSurroundingAgent(this.agent);
        this.realm = new ManagedRealm({});

        this._setupGlobals();
    }

    private _setupGlobals() {
        this.realm.scope(() => {});
    }
}
