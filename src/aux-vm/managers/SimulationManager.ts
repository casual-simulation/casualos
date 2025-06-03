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
import type { Initable } from './Initable';
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import type { Simulation } from './Simulation';

export type SubSimEmitter = Pick<
    Simulation,
    'onSubSimulationAdded' | 'onSubSimulationRemoved' | 'isSubSimulation'
>;

export interface SimulationFactoryOptions {
    /**
     * The name of the record that the simulation should be loaded from.
     */
    recordName: string | null;

    /**
     * The name of the inst that the simulation should be loaded from.
     */
    inst: string | null;

    /**
     * The host for the simulation.
     */
    host?: string;

    /**
     * Whether the simulation should be loaded as static.
     */
    isStatic?: boolean;
}

/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<
    TSimulation extends Initable & Partial<SubSimEmitter>
> {
    private _factory: SimulationFactory<TSimulation>;
    private _simulationAdded: Subject<TSimulation>;
    private _simulationRemoved: Subject<TSimulation>;
    private _simulationSubscriptions: Map<string, Subscription>;
    private _simulationPromises: Map<string, Promise<TSimulation>>;
    private _initializedSimulations: Map<string, TSimulation> = new Map();

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
            startWith(...this._initializedSimulations.values())
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
     * @param sims The simulations that should be loaded.
     */
    async updateSimulations(
        sims: { id: string; options: SimulationFactoryOptions }[]
    ) {
        for (let i = 0; i < sims.length; i++) {
            const sim = sims[i];

            if (!this.simulations.has(sim.id)) {
                await this.addSimulation(sim.id, sim.options);
            }
        }

        for (let [id, sim] of this.simulations) {
            if (!sims.find((s) => s.id === id)) {
                await this.removeSimulation(id);
            }
        }
    }

    /**
     * Removes all the simulations that do not match the given ID.
     * @param id The ID of the simulation to keep.
     */
    async removeNonMatchingSimulations(id: string) {
        let promises: Promise<void>[] = [];
        for (let [key, value] of this.simulations) {
            if (key !== id && !value.isSubSimulation) {
                promises.push(this.removeSimulation(key));
            }
        }

        await Promise.all(promises);
    }

    /**
     * Sets the primary simulation.
     * @param id The ID to load.
     * @param loadingCallback The loading progress callback to use.
     */
    async setPrimary(
        id: string,
        options: SimulationFactoryOptions
    ): Promise<TSimulation> {
        const promise = this.addSimulation(id, options);
        this.primaryId = id;
        this.primaryPromise = promise;
        let added = await promise;

        return added;
    }

    /**
     * Adds a new simulation using the given ID.
     * @param id The ID of the simulation to add.
     */
    addSimulation(
        id: string,
        options: SimulationFactoryOptions
    ): Promise<TSimulation> {
        if (this._simulationPromises.has(id)) {
            return this._simulationPromises.get(id);
        } else {
            const promise = this._initSimulation(id, options);
            this._simulationPromises.set(id, promise);
            return promise;
        }
    }

    private async _initSimulation(
        id: string,
        options: SimulationFactoryOptions
    ) {
        const sim = await this._factory(id, options);
        if (id === this.primaryId) {
            this.primary = sim;
        }
        return this._initSimulationCore(id, sim);
    }

    private async _initSimulationCore(
        id: string,
        sim: TSimulation
    ): Promise<TSimulation> {
        let sub = new Subscription();
        sub.add(
            sim.onError.subscribe((e) => {
                console.error(e);
                this.removeSimulation(id);
            })
        );

        if (sim.onSubSimulationAdded) {
            sub.add(
                sim.onSubSimulationAdded.subscribe((s) => {
                    const promise = this._initSimulationCore(
                        s.id,
                        <TSimulation>(<unknown>s)
                    );
                    this._simulationPromises.set(s.id, promise);
                })
            );
        }

        if (sim.onSubSimulationRemoved) {
            sub.add(
                sim.onSubSimulationRemoved.subscribe((s) => {
                    this.removeSimulation(s.id);
                })
            );
        }

        this._simulationSubscriptions.set(id, sub);
        this.simulations.set(id, sim);

        await sim.init();

        this._initializedSimulations.set(id, sim);
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
            this._initializedSimulations.delete(id);
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

export type SimulationFactory<TSimulation> = (
    id: string,
    options: SimulationFactoryOptions
) => TSimulation | Promise<TSimulation>;
