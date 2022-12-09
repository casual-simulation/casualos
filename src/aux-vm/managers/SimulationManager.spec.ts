import { Observable, Subject, Subscription } from 'rxjs';
import { SimulationManager, SubSimEmitter } from './SimulationManager';
import { Initable } from './Initable';
import { Simulation } from './Simulation';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

console.error = jest.fn();

describe('SimulationManager', () => {
    it('should start empty', () => {
        let called = false;
        const manager = new SimulationManager((id) => {
            called = true;
            return new TestInitable();
        });

        expect(manager.primary).toBeFalsy();
        expect(called).toBe(false);
    });

    describe('addSimulation()', () => {
        it('should make a new simulation and add it to the simulations map', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const added = await manager.addSimulation('test');

            expect(manager.simulations.has('test')).toBe(true);
            expect(added).toBe(manager.simulations.get('test'));
            expect(manager.simulations.get('test').initialized).toBe(true);
        });

        it('should reuse the simulation if it already exists', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const val = new TestInitable();
            manager.simulations.set('test', val);
            const first = manager.addSimulation('test');
            const second = manager.addSimulation('test');

            expect(await first).toBe(await second);
        });

        it('should trigger a simulationAdded event', async () => {
            let sims: TestInitable[] = [];
            const manager = new SimulationManager((id) => new TestInitable());
            manager.simulationAdded.subscribe((sim) => sims.push(sim));

            const added = await manager.addSimulation('test');

            expect(sims.length).toBe(1);
        });
    });

    describe('removeSimulation()', () => {
        it('should do nothing if the simulation doesnt exist', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            await manager.removeSimulation('test');
        });

        it('should remove the given simulation from the map', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const val = await manager.addSimulation('test');

            await manager.removeSimulation('test');

            expect(manager.simulations.has('test')).toBe(false);
            expect(val.closed).toBe(true);
        });

        it('should clear the primary sim if the removed is the primary', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const val = await manager.setPrimary('test');

            await manager.removeSimulation('test');

            expect(manager.primary).toBe(null);
        });

        it('should trigger a simulationRemoved event', async () => {
            let sims: TestInitable[] = [];
            const manager = new SimulationManager((id) => new TestInitable());
            manager.simulationRemoved.subscribe((sim) => sims.push(sim));

            const added = await manager.addSimulation('test');
            await manager.removeSimulation('test');

            expect(sims).toEqual([added]);
        });
    });

    describe('setPrimary()', () => {
        it('should initialize the primary simulation', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            expect(manager.primary).toBeFalsy();

            await manager.setPrimary('test');

            expect(manager.primary).toBeInstanceOf(TestInitable);
            expect(manager.primary.initialized).toBe(true);
        });
    });

    describe('clear()', () => {
        it('should dispose and remove all the simulations', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            await manager.addSimulation('test');
            await manager.addSimulation('test2');
            await manager.setPrimary('test3');

            await manager.clear();

            expect(manager.simulations.size).toBe(0);
            expect(manager.primary).toBe(null);
        });
    });

    describe('simulationAdded', () => {
        it('should replay all the simulationAdded events on subscription', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const added = await manager.addSimulation('test');
            let sims: TestInitable[] = [];
            manager.simulationAdded.subscribe((sim) => sims.push(sim));

            expect(sims.length).toBe(1);
            expect(sims).toEqual([added]);
        });

        it('should not include simulations that have been removed in the replay', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            await manager.addSimulation('test');
            await manager.removeSimulation('test');

            let sims: TestInitable[] = [];
            manager.simulationAdded.subscribe((sim) => sims.push(sim));

            expect(sims).toEqual([]);
        });
    });

    describe('simulationRemoved', () => {
        it('should not replay all the simulationRemoved events on subscription', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            await manager.addSimulation('test');
            await manager.removeSimulation('test');

            let sims: TestInitable[] = [];
            manager.simulationRemoved.subscribe((sim) => sims.push(sim));

            expect(sims).toEqual([]);
        });
    });

    describe('watchSimulations()', () => {
        it('should call the given function with all the current simulations', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const added = await manager.addSimulation('test');
            let sims: TestInitable[] = [];
            manager.watchSimulations((sim) => {
                sims.push(sim);
                return new Subscription();
            });

            expect(sims.length).toBe(1);
            expect(sims).toEqual([added]);
        });

        it('should return a subscription that disposes all the simulation-specific subscriptions', async () => {
            const manager = new SimulationManager((id) => new TestInitable());

            const added = await manager.addSimulation('test');
            let sims: TestInitable[] = [];
            let called = false;
            let sub = manager.watchSimulations((sim) => {
                sims.push(sim);
                return new Subscription(() => {
                    called = true;
                });
            });

            sub.unsubscribe();

            expect(called).toBe(true);
        });
    });

    describe('sub simulations', () => {
        let manager: SimulationManager<TestSubSimulation>;

        beforeEach(() => {
            manager = new SimulationManager((id) => new TestSubSimulation());
        });

        afterEach(() => {
            manager.clear();
        });

        it('should add new sub simulations to its list of simulations', async () => {
            const sim = await manager.addSimulation('mySim');

            const newSim = new TestSubSimulation();
            newSim.id = 'new-sim';

            expect(newSim.initialized).toBe(false);

            sim.onSubSimulationAdded.next(newSim as unknown as Simulation);

            await waitAsync();

            expect(manager.simulations.size).toBe(2);
            expect(newSim.initialized).toBe(true);
            expect(manager.simulations.get('new-sim') === newSim).toBe(true);
        });

        it('should remove sub simulations from the list of simulations', async () => {
            const sim = await manager.addSimulation('mySim');

            const newSim = new TestSubSimulation();
            newSim.id = 'new-sim';

            expect(newSim.initialized).toBe(false);

            sim.onSubSimulationAdded.next(newSim as unknown as Simulation);

            await waitAsync();

            expect(manager.simulations.size).toBe(2);
            expect(newSim.initialized).toBe(true);
            expect(manager.simulations.get('new-sim') === newSim).toBe(true);

            newSim.unsubscribe();
            expect(newSim.closed).toBe(true);

            sim.onSubSimulationRemoved.next(newSim as unknown as Simulation);

            await waitAsync();

            expect(manager.simulations.size).toBe(1);
            expect(newSim.closed).toBe(true);
            expect(manager.simulations.has('new-sim')).toBe(false);
        });
    });
});

class TestInitable implements Initable {
    onError = new Subject<any>();
    initialized: boolean;
    closed: boolean;

    action: Function;

    constructor(action?: Function) {
        this.action = action;
        this.initialized = false;
    }

    async init() {
        this.initialized = true;
        if (this.action) {
            return this.action();
        }
        return null;
    }

    unsubscribe(): void {
        this.closed = true;
    }
}

class TestSubSimulation extends TestInitable implements SubSimEmitter {
    id: string;

    constructor(action?: Function) {
        super(action);
        this.onSubSimulationAdded = new Subject();
        this.onSubSimulationRemoved = new Subject();
    }

    onSubSimulationAdded: Subject<Simulation>;
    onSubSimulationRemoved: Subject<Simulation>;
}
