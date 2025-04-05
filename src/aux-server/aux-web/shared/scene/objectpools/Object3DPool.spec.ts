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
