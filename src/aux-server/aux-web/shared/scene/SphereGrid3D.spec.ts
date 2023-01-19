import { Ray, Vector3 } from '@casual-simulation/three';
import { SphereGrid3D } from './SphereGrid3D';

describe('SphereGrid3D', () => {
    let grid: SphereGrid3D;

    beforeEach(() => {
        grid = new SphereGrid3D();
        grid.useLatLon = true;
    });

    describe('getPointFromRay()', () => {
        const cases = [
            [
                new Vector3(0, 5, 0),
                new Vector3(0, -1, 0),
                new Vector3(90, 0, 0),
            ],
            [
                new Vector3(0, -5, 0),
                new Vector3(0, 1, 0),
                new Vector3(-90, 0, 0),
            ],
            [new Vector3(5, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 0)],
            [
                new Vector3(-5, 0, 0),
                new Vector3(1, 0, 0),
                new Vector3(180, 0, 0),
            ],

            [
                new Vector3(0, 0, 5),
                new Vector3(0, 0, -1),
                new Vector3(0, 90, 0),
            ],
            [
                new Vector3(0, 0, -5),
                new Vector3(0, 0, 1),
                new Vector3(0, -90, 0),
            ],
        ];

        it.each(cases)(
            'should map (%s, %s) -> %s',
            (origin, direction, expected) => {
                const point = grid.getPointFromRay(new Ray(origin, direction));

                expect(point).toEqual(expected);
            }
        );

        it('should correctly handle world positions', () => {
            grid.position.set(10, 10, 5);
            const ray = new Ray(new Vector3(15, 10, 5), new Vector3(-1, 0, 0));

            const point = grid.getPointFromRay(ray);

            expect(point).toEqual(new Vector3(0, 0, 0));
        });

        it('should correctly handle world positions and rotations', () => {
            grid.position.set(10, 10, 5);
            grid.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
            grid.updateMatrixWorld();
            const ray = new Ray(new Vector3(15, 10, 5), new Vector3(-1, 0, 0));

            const point = grid.getPointFromRay(ray);

            expect(point).toEqual(new Vector3(180, 90, 0));
        });

        it('should return normal coordiantes if not using lat/lon', () => {
            grid.useLatLon = false;
            const point = grid.getPointFromRay(
                new Ray(new Vector3(0, 5, 0), new Vector3(0, -1, 0))
            );

            expect(point).toEqual(new Vector3(0, 0.5, 0));
        });
    });

    describe('getTileFromRay()', () => {
        const cases = [
            [
                new Vector3(0, 5, 0),
                new Vector3(0, -1, 0),
                new Vector3(90, 0, 0),
            ],
            [
                new Vector3(0, -5, 0),
                new Vector3(0, 1, 0),
                new Vector3(-90, 0, 0),
            ],
            [new Vector3(5, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 0)],
            [
                new Vector3(-5, 0, 0),
                new Vector3(1, 0, 0),
                new Vector3(180, 0, 0),
            ],

            [
                new Vector3(0, 0, 5),
                new Vector3(0, 0, -1),
                new Vector3(0, 90, 0),
            ],
            [
                new Vector3(0, 0, -5),
                new Vector3(0, 0, 1),
                new Vector3(0, -90, 0),
            ],
        ];

        it.each(cases)(
            'should map (%s, %s) -> %s',
            (origin, direction, expected) => {
                const tile = grid.getTileFromRay(
                    new Ray(origin, direction),
                    true
                );

                expect(tile.center.x).toBeCloseTo(expected.x);
                expect(tile.center.y).toBeCloseTo(expected.y);
                expect(tile.center.z).toBeCloseTo(expected.z);
            }
        );
    });
});
