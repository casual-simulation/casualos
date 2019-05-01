import { Initable } from './Initable';

/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<TSimulation extends Initable>
    implements Initable {
    private _factory: SimulationFactory<TSimulation>;
    private _initPromise: Promise<void>;

    /**
     * The primary simulation to use.
     */
    primary: TSimulation;

    /**
     * The map of simulations to their IDs.
     */
    simulations: Map<string, TSimulation>;

    /**
     * Creates a new simulation manager using the given simulation factory.
     * @param factory A function that, given an simulation ID, creates a new simulation.
     * @param primaryId The ID of the primary simulation to load.
     */
    constructor(factory: SimulationFactory<TSimulation>, primaryId: string) {
        this._factory = factory;
        this.primary = this._factory(primaryId);
    }

    init() {
        if (this._initPromise) {
            return this._initPromise;
        } else {
            return (this._initPromise = this._init());
        }
    }

    private async _init() {
        await this.primary.init();
    }
}

export type SimulationFactory<TSimulation> = (id: string) => TSimulation;
