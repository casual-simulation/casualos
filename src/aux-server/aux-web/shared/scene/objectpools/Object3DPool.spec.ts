import { Object3DPool } from './Object3DPool';
import { Object3D } from '@casual-simulation/three';

describe('Object3DPool', () => {
    // Source object for all our object 3d pool tests.
    const sourceObject = new Object3D();

    it('should construct with given start size', () => {
        let pool = new Object3DPool(sourceObject).initializePool(3);
        expect(pool.poolSize).toEqual(3);
        pool.dispose();
    });

    it('should dispose', () => {
        let pool = new Object3DPool(sourceObject).initializePool(3);
        expect(pool.poolSize).toEqual(3);
        pool.dispose();
        expect(pool.poolSize).toEqual(0);
    });

    it('should retrieve object and restore said object', () => {
        let pool = new Object3DPool(sourceObject).initializePool(3);
        expect(pool.poolSize).toEqual(3);
        let obj = pool.retrieve();

        expect(obj).toBeInstanceOf(Object3D);
        expect(pool.poolSize).toEqual(2);

        let restored = pool.restore(obj);
        expect(restored).toEqual(true);
        expect(pool.poolSize).toEqual(3);
    });

    it('should not allow restoration of objects that did not originate from it', () => {
        let spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        let pool = new Object3DPool(sourceObject).initializePool(3);
        let obj = pool.retrieve();

        expect(pool.poolSize).toEqual(2);

        let illegalObject = new Object3D();
        let restored = pool.restore(illegalObject);
        expect(restored).toEqual(false);
        expect(pool.poolSize).toEqual(2);
        pool.dispose();

        spy.mockRestore();
    });
});
