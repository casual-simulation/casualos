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
