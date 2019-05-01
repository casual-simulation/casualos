import { SimulationManager } from './SimulationManager';
import { Initable } from './Initable';

describe('SimulationManager', () => {
    it('should start empty', () => {
        let called = false;
        const manager = new SimulationManager(id => {
            called = true;
            return new TestInitable();
        });

        expect(manager.primary).toBeFalsy();
        expect(called).toBe(false);
    });

    describe('addSimulation()', () => {
        it('should make a new simulation and add it to the simulations map', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            const added = await manager.addSimulation('test');

            expect(manager.simulations.has('test')).toBe(true);
            expect(added).toBe(manager.simulations.get('test'));
            expect(manager.simulations.get('test').initialized).toBe(true);
        });

        it('should not add the simulation if it already exists', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            const val = new TestInitable();
            manager.simulations.set('test', val);

            const added = await manager.addSimulation('test');

            expect(manager.simulations.get('test')).toBe(val);
            expect(val.initialized).toBeFalsy();
            expect(added).toBe(val);
        });
    });

    describe('removeSimulation()', () => {
        it('should do nothing if the simulation doesnt exist', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            await manager.removeSimulation('test');
        });

        it('should remove the given simulation from the map', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            const val = new TestInitable();
            manager.simulations.set('test', val);

            await manager.removeSimulation('test');

            expect(manager.simulations.has('test')).toBe(false);
            expect(val.closed).toBe(true);
        });

        it('should clear the primary sim if the removed is the primary', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            const val = new TestInitable();
            manager.simulations.set('test', val);
            manager.primary = val;

            await manager.removeSimulation('test');

            expect(manager.primary).toBe(null);
        });
    });

    describe('setPrimary()', () => {
        it('should initialize the primary simulation', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            expect(manager.primary).toBeFalsy();

            await manager.setPrimary('test');

            expect(manager.primary).toBeInstanceOf(TestInitable);
            expect(manager.primary.initialized).toBe(true);
        });
    });

    describe('clear()', () => {
        it('should dispose and remove all the simulations', async () => {
            const manager = new SimulationManager(id => new TestInitable());

            const sim = new TestInitable();
            manager.simulations.set('test', sim);
            manager.simulations.set('test2', new TestInitable());
            manager.primary = sim;

            await manager.clear();

            expect(manager.simulations.size).toBe(0);
            expect(manager.primary).toBe(null);
        });
    });
});

class TestInitable implements Initable {
    initialized: boolean;
    closed: boolean;

    async init() {
        this.initialized = true;
    }

    unsubscribe(): void {
        this.closed = true;
    }
}
