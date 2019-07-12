import { Initable } from './Initable';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import { Subject, ReplaySubject, Observable, Subscription } from 'rxjs';

/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<TSimulation extends Initable> {
    private _factory: SimulationFactory<TSimulation>;
    private _simulationAdded: ReplaySubject<TSimulation>;
    private _simulationRemoved: ReplaySubject<TSimulation>;
    private _simulationSubscriptions: Map<string, Subscription>;

    /**
     * The primary simulation to use.
     */
    primary: TSimulation;

    /**
     * The map of simulations to their IDs.
     */
    simulations: Map<string, TSimulation>;

    /**
     * Gets an observable that resolves whenever a simulation is added to the
     * simulation manager.
     */
    get simulationAdded(): Observable<TSimulation> {
        return this._simulationAdded;
    }

    /**
     * Gets an observable that resolves whenever a simulation is removed from the simulation manager.
     */
    get simulationRemoved(): Observable<TSimulation> {
        return this._simulationRemoved;
    }

    /**
     * Creates a new simulation manager using the given simulation factory.
     * @param factory A function that, given an simulation ID, creates a new simulation.
     */
    constructor(factory: SimulationFactory<TSimulation>) {
        this._factory = factory;
        this.simulations = new Map();
        this._simulationSubscriptions = new Map();
        this.primary = null;
        this._simulationAdded = new ReplaySubject();
        this._simulationRemoved = new ReplaySubject();
    }

    /**
     * Updates the list of loaded simulations to
     * contain only the given list of IDs.
     * @param ids The simulations that should be loaded.
     */
    async updateSimulations(ids: string[]) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];

            if (!this.simulations.has(id)) {
                await this.addSimulation(id);
            }
        }

        for (let [id, sim] of this.simulations) {
            if (!ids.find(i => i === id)) {
                await this.removeSimulation(id);
            }
        }
    }

    /**
     * Sets the primary simulation.
     * @param id The ID to load.
     * @param loadingCallback The loading progress callback to use.
     */
    async setPrimary(
        id: string,
        loadingCallback?: LoadingProgressCallback
    ): Promise<TSimulation> {
        let added = await this.addSimulation(id, loadingCallback);

        this.primary = added;

        return added;
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

            let sub = new Subscription();
            sub.add(
                sim.onError.subscribe(e => {
                    console.error(e);
                    this.removeSimulation(id);
                })
            );
            this._simulationSubscriptions.set(id, sub);
            this.simulations.set(id, sim);

            await sim.init(loadingCallback);

            this._simulationAdded.next(sim);
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
            if (this._simulationSubscriptions.has(id)) {
                const sub = this._simulationSubscriptions.get(id);
                sub.unsubscribe();
            }
            if (sim === this.primary) {
                this.primary = null;
            }
            this.simulations.delete(id);
            this._simulationSubscriptions.delete(id);
            this._simulationRemoved.next(sim);
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
