import { Initable } from './Initable';
import { Subject, Observable, Subscription, SubscriptionLike } from 'rxjs';
import { startWith } from 'rxjs/operators';

/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<TSimulation extends Initable> {
    private _factory: SimulationFactory<TSimulation>;
    private _simulationAdded: Subject<TSimulation>;
    private _simulationRemoved: Subject<TSimulation>;
    private _simulationSubscriptions: Map<string, Subscription>;
    private _simulationPromises: Map<string, Promise<TSimulation>>;

    /**
     * The ID of the primary simulation.
     */
    primaryId: string;

    /**
     * The primary simulation to use.
     */
    primary: TSimulation;

    /**
     * The promise of the primary simulation.
     */
    primaryPromise: Promise<TSimulation>;

    /**
     * The map of simulations to their IDs.
     */
    simulations: Map<string, TSimulation>;

    /**
     * Gets an observable that resolves whenever a simulation is added to the
     * simulation manager.
     */
    get simulationAdded(): Observable<TSimulation> {
        return this._simulationAdded.pipe(
            startWith(...this.simulations.values())
        );
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
        this._simulationPromises = new Map();
        this.primary = null;
        this._simulationAdded = new Subject();
        this._simulationRemoved = new Subject();
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
            if (!ids.find((i) => i === id)) {
                await this.removeSimulation(id);
            }
        }
    }

    /**
     * Sets the primary simulation.
     * @param id The ID to load.
     * @param loadingCallback The loading progress callback to use.
     */
    async setPrimary(id: string): Promise<TSimulation> {
        const promise = this.addSimulation(id);
        this.primaryId = id;
        this.primaryPromise = promise;
        let added = await promise;

        this.primary = added;

        return added;
    }

    /**
     * Adds a new simulation using the given ID.
     * @param id The ID of the simulation to add.
     */
    addSimulation(id: string): Promise<TSimulation> {
        if (this._simulationPromises.has(id)) {
            return this._simulationPromises.get(id);
        } else {
            const promise = this._initSimulation(id);
            this._simulationPromises.set(id, promise);
            return promise;
        }
    }

    private async _initSimulation(id: string) {
        const sim = this._factory(id);

        let sub = new Subscription();
        sub.add(
            sim.onError.subscribe((e) => {
                console.error(e);
                this.removeSimulation(id);
            })
        );
        this._simulationSubscriptions.set(id, sub);
        this.simulations.set(id, sim);

        await sim.init();

        this._simulationAdded.next(sim);
        return sim;
    }

    /**
     * Removes the simulation with the given ID.
     * @param id The ID of the simulation to remove.
     */
    async removeSimulation(id: string) {
        if (this._simulationPromises.has(id)) {
            const sim = await this._simulationPromises.get(id);
            sim.unsubscribe();
            if (this._simulationSubscriptions.has(id)) {
                const sub = this._simulationSubscriptions.get(id);
                sub.unsubscribe();
            }
            if (sim === this.primary) {
                this.primary = null;
            }
            this.simulations.delete(id);
            this._simulationPromises.delete(id);
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

    /**
     * Calls the given function for current and new simulations and uses the subscription returned by the function to manage resources.
     * The subscription will automatically be unsubscribed when the simulation is removed.
     * Returns a subscription that can be used to unsubscribe resources and stop watching.
     *
     * @param onSimulationAdded The function that should be called for each simulation.
     */
    watchSimulations(
        onSimulationAdded: (sim: TSimulation) => SubscriptionLike
    ): Subscription {
        let sub = new Subscription();

        let simulationSubs = new Map<TSimulation, Subscription>();
        sub.add(
            this.simulationAdded.subscribe((sim) => {
                let simSub = onSimulationAdded(sim);
                if (simSub) {
                    const s = new Subscription(() => simSub.unsubscribe());
                    simulationSubs.set(sim, s);
                    sub.add(s);
                }
            })
        );

        sub.add(
            this.simulationRemoved.subscribe((sim) => {
                let simSub = simulationSubs.get(sim);
                if (simSub) {
                    simSub.unsubscribe();
                }
            })
        );

        return sub;
    }
}

export type SimulationFactory<TSimulation> = (id: string) => TSimulation;
