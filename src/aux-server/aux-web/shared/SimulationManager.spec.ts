import { SimulationManager } from './SimulationManager';
import { Initable } from './Initable';

describe('SimulationManager', () => {
    it('should create the primary simulation immediately', () => {
        let called = false;
        const manager = new SimulationManager(id => {
            expect(id).toBe('test');
            called = true;
            return new TestInitable();
        }, 'test');

        expect(manager.primary).toBeInstanceOf(TestInitable);
        expect(called).toBe(true);
    });

    describe('init()', () => {
        it('should initialize the primary simulation', async () => {
            const manager = new SimulationManager(
                id => new TestInitable(),
                'test'
            );

            expect(manager.primary).toBeInstanceOf(TestInitable);
            expect(manager.primary.initialized).toBeFalsy();

            await manager.init();

            expect(manager.primary.initialized).toBe(true);
        });
    });
});

class TestInitable implements Initable {
    initialized: boolean;

    async init() {
        this.initialized = true;
    }
}
