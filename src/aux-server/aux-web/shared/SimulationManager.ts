import { Initable } from './Initable';
import { LoadingProgressCallback } from '@casual-simulation/aux-common/LoadingProgress';

/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<TSimulation extends Initable> {
    private _factory: SimulationFactory<TSimulation>;

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
     */
    constructor(factory: SimulationFactory<TSimulation>) {
        this._factory = factory;
        this.simulations = new Map();
        this.primary = null;
    }

    /**
     * Sets the primary simulation.
     * @param id The ID to load.
     * @param loadingCallback The loading progress callback to use.
     */
    async setPrimary(id: string, loadingCallback?: LoadingProgressCallback) {
        this.primary = await this.addSimulation(id, loadingCallback);
    }

    /**
     * Adds a new simulation using the given ID.
     * @param id The ID of the simulation to add.
     */
    async addSimulation(
        id: string,
        loadingCallback?: LoadingProgressCallback
    ): Promise<TSimulation> {
        if (this.simulations.has(id)) {
            return this.simulations.get(id);
        } else {
            const sim = this._factory(id);
            await sim.init(loadingCallback);
            this.simulations.set(id, sim);
            return sim;
        }
    }

    /**
     * Removes the simulation with the given ID.
     * @param id The ID of the simulation to remove.
     */
    async removeSimulation(id: string) {
        if (this.simulations.has(id)) {
            const sim = this.simulations.get(id);
            sim.unsubscribe();
            if (sim === this.primary) {
                this.primary = null;
            }
            this.simulations.delete(id);
        }
    }

    /**
     * Clears all the simulations.
     */
    async clear() {
        this.simulations.forEach((sim, id) => {
            this.removeSimulation(id);
        });
    }
}

export type SimulationFactory<TSimulation> = (id: string) => TSimulation;
