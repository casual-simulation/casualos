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
import { PriorityGrid3D } from './PriorityGrid3D';
import { BoundedGrid3D } from './BoundedGrid3D';
import { Ray, Vector3 } from '@casual-simulation/three';

describe('PriorityGrid3D', () => {
    describe('getTileFromRay()', () => {
        it('should return the tile from first closest grid', () => {
            const priorityGrid = new PriorityGrid3D();

            const grid1 = new BoundedGrid3D();
            grid1.position.set(0, 0, 0);
            grid1.updateMatrixWorld(true);

            const grid2 = new BoundedGrid3D();
            grid2.position.set(0, 1, 0);
            grid2.updateMatrixWorld(true);

            priorityGrid.grids.push(grid1, grid2);

            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getTileFromRay(ray, true);
            const expected = grid1.getTileFromRay(ray, true);

            expect(actual.tileCoordinate).toEqual(expected.tileCoordinate);
            expect(actual.center).toEqual(expected.center);
            expect(actual.corners).toEqual(expected.corners);
            expect(actual.grid).toBe(expected.grid);
        });

        it('should ignore grids that are not enabled', () => {
            const priorityGrid = new PriorityGrid3D();

            const grid1 = new BoundedGrid3D();
            grid1.position.set(0, 0, 0);
            grid1.enabled = false;
            grid1.updateMatrixWorld(true);

            const grid2 = new BoundedGrid3D();
            grid2.position.set(0, 1, 0);
            grid2.updateMatrixWorld(true);

            priorityGrid.grids.push(grid1, grid2);

            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getTileFromRay(ray, true);
            const expected = grid2.getTileFromRay(ray, true);

            expect(actual.tileCoordinate).toEqual(expected.tileCoordinate);
            expect(actual.center).toEqual(expected.center);
            expect(actual.corners).toEqual(expected.corners);
            expect(actual.grid).toBe(expected.grid);
        });

        it('should return null if there is no grid', () => {
            const priorityGrid = new PriorityGrid3D();
            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getTileFromRay(ray, true);

            expect(actual).toBe(null);
        });
    });

    describe('getPointFromRay()', () => {
        it('should return the point from the first grid', () => {
            const priorityGrid = new PriorityGrid3D();

            const grid1 = new BoundedGrid3D();
            grid1.position.set(0, 0, 0);
            grid1.updateMatrixWorld(true);

            const grid2 = new BoundedGrid3D();
            grid2.position.set(0, 1, 0);
            grid2.updateMatrixWorld(true);

            priorityGrid.grids.push(grid1, grid2);

            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getPointFromRay(ray);
            const expected = grid1.getPointFromRay(ray);

            expect(actual).toEqual(expected);
        });

        it('should ignore grids that are not enabled', () => {
            const priorityGrid = new PriorityGrid3D();

            const grid1 = new BoundedGrid3D();
            grid1.position.set(0, 0, 0);
            grid1.enabled = false;
            grid1.updateMatrixWorld(true);

            const grid2 = new BoundedGrid3D();
            grid2.position.set(0, 1, 0);
            grid2.updateMatrixWorld(true);

            priorityGrid.grids.push(grid1, grid2);

            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getPointFromRay(ray);
            const expected = grid2.getPointFromRay(ray);

            expect(actual).toEqual(expected);
        });

        it('should return null if there is no grid', () => {
            const priorityGrid = new PriorityGrid3D();
            const ray = new Ray(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
            const actual = priorityGrid.getPointFromRay(ray);

            expect(actual).toBe(null);
        });
    });
});
