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
import {
    createBot,
    createPrecalculatedContext,
} from '@casual-simulation/aux-common';
import {
    calculateScale,
    createCube,
    percentOfScreen,
    calculateHitFace,
    calculateCubeSphereIntersection,
    addCorsQueryParam,
} from './SceneUtils';
import type { Camera, Mesh } from '@casual-simulation/three';
import {
    Box3,
    OrthographicCamera,
    Sphere,
    Vector2,
    Vector3,
    Group,
} from '@casual-simulation/three';

describe('SceneUtils', () => {
    describe('calculateScale()', () => {
        it('should not swap the Y and Z values', () => {
            const bot = createBot('bot', {
                scaleX: 2,
                scaleY: 3,
                scaleZ: 4,
            });
            const calc = createPrecalculatedContext([bot]);

            const scale = calculateScale(calc, bot, 2);
            expect(scale.x).toEqual(4);
            expect(scale.y).toEqual(6);
            expect(scale.z).toEqual(8);
        });

        it('should support the old tag names', () => {
            const bot = createBot('bot', {
                auxScaleX: 2,
                auxScaleY: 3,
                auxScaleZ: 4,
            });
            const calc = createPrecalculatedContext([bot]);

            const scale = calculateScale(calc, bot, 2);
            expect(scale.x).toEqual(4);
            expect(scale.y).toEqual(6);
            expect(scale.z).toEqual(8);
        });
    });

    describe('percentOfScreen()', () => {
        describe('orthographic', () => {
            let cube: Mesh;
            let camera: Camera;

            const cubeSize = 1;
            const left = -10;
            const right = 10;
            const top = 10;
            const bottom = -10;
            const near = -10;
            const far = 10;
            const width = right - left;
            const height = top - bottom;
            const depth = far - near;
            const areaOfScreen = width * height;

            // Diameter of smallest sphere containing cube is the length of the diagonal
            // between the cube's corners which is just the pythagorean theorem.
            const cubeSizeSquared = cubeSize * cubeSize;
            const sphereDiameter = Math.sqrt(
                cubeSizeSquared + cubeSizeSquared + cubeSizeSquared
            );
            const sphereRadius = sphereDiameter * 0.5;

            // Spheres are uniform so we're able to flatten it to a circle for area calculation
            // because they look the same from every angle.
            const circleArea = Math.PI * sphereRadius * sphereRadius;

            const cameraPosition = new Vector3(0, 0, 0);

            beforeEach(() => {
                cube = createCube(cubeSize);
                camera = new OrthographicCamera(
                    left,
                    right,
                    top,
                    bottom,
                    near,
                    far
                );
                camera.position.copy(cameraPosition);
            });

            it('should return the approximate size of the given bounding sphere if it was on the screen', () => {
                const box = new Box3().setFromObject(cube);
                const sphere = new Sphere();
                box.getBoundingSphere(sphere);

                const percent = percentOfScreen(camera, sphere);

                expect(percent).toBeCloseTo(circleArea / areaOfScreen, 6);
            });

            describe('clipping', () => {
                const leftEdge = new Vector3(left - cubeSize, 0, 0);
                const rightEdge = new Vector3(right + cubeSize, 0, 0);
                const topEdge = new Vector3(0, top + cubeSize, 0);
                const bottomEdge = new Vector3(0, bottom - cubeSize, 0);

                const namedEdges = [
                    ['left', leftEdge],
                    ['right', rightEdge],
                    ['top', topEdge],
                    ['bottom', bottomEdge],
                ] as const;

                const singleEdgeCases = namedEdges.map(([name, pos]) => [
                    `${name} edge`,
                    pos,
                ]);

                const edgePairs = [
                    ['left and top', leftEdge, topEdge],
                    ['right and top', rightEdge, topEdge],
                    ['left and bottom', leftEdge, bottomEdge],
                    ['right and bottom', rightEdge, bottomEdge],
                ] as const;

                const twoEdgeCases = edgePairs.map(([name, p1, p2]) => [
                    `${name} edges`,
                    p1.clone().add(p2),
                ]);

                const clippingCases = [...singleEdgeCases, ...twoEdgeCases];

                it.each(clippingCases)(
                    'should return 0 when off the %s of the projection',
                    (desc: string, pos: Vector3) => {
                        cube.position.copy(pos);
                        const box = new Box3().setFromObject(cube);
                        const sphere = new Sphere();
                        box.getBoundingSphere(sphere);

                        const percent = percentOfScreen(camera, sphere);

                        expect(percent).toBe(0);
                    }
                );
            });
        });
    });

    describe('addCorsQueryParam()', () => {
        it('should add the cors-cache query param', () => {
            let result = addCorsQueryParam('https://example.com/file.png');
            expect(result).toBe('https://example.com/file.png?cors-cache=');
        });

        it('should do nothing for requests that already have a cors-cache query param', () => {
            let result = addCorsQueryParam(
                'https://example.com/file.png?cors-cache=test'
            );
            expect(result).toBe('https://example.com/file.png?cors-cache=test');
        });

        it('should not add the cors-cache param if the casualos-no-cors-cache=true param is set', () => {
            let result = addCorsQueryParam(
                'https://example.com/file.png?casualos-no-cors-cache=true'
            );

            // It should remove the casualos-no-cors-cache=true query param
            // so that the original URL is preserved.
            expect(result).toBe('https://example.com/file.png');
        });

        it('should ignore data URLs', () => {
            let result = addCorsQueryParam('data:image/png;base64,abcdef');
            expect(result).toBe('data:image/png;base64,abcdef');
        });

        it('should ignore blob URLs', () => {
            let result = addCorsQueryParam(
                'blob:https://javascript.info/1e67e00e-860d-40a5-89ae-6ab0cbee6273'
            );
            expect(result).toBe(
                'blob:https://javascript.info/1e67e00e-860d-40a5-89ae-6ab0cbee6273'
            );
        });

        it('should ignore file URLs', () => {
            let result = addCorsQueryParam('file://path/to/file');
            expect(result).toBe('file://path/to/file');
        });

        it('should ignore chrome URLs', () => {
            let result = addCorsQueryParam('chrome://version');
            expect(result).toBe('chrome://version');
        });

        it('should ignore edge URLs', () => {
            let result = addCorsQueryParam('edge://version');
            expect(result).toBe('edge://version');
        });

        it('should ignore FTP URLs', () => {
            let result = addCorsQueryParam('ftp://ip_address/');
            expect(result).toBe('ftp://ip_address/');
        });
    });

    describe('calculateHitFace()', () => {
        it('should return null if the intersection has no hit face', () => {
            expect(calculateHitFace({} as any)).toBe(null);
        });

        it('should return back if the face is normal along the Y axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: 0,
                            y: 1,
                            z: 0,
                        },
                    },
                } as any)
            ).toBe('back');
        });

        it('should return front if the face is normal along the -Y axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: 0,
                            y: -1,
                            z: 0,
                        },
                    },
                } as any)
            ).toBe('front');
        });

        it('should return top if the face is normal along the Z axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: 0,
                            y: 0,
                            z: 1,
                        },
                    },
                } as any)
            ).toBe('top');
        });

        it('should return bottom if the face is normal along the -Z axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: 0,
                            y: 0,
                            z: -1,
                        },
                    },
                } as any)
            ).toBe('bottom');
        });

        it('should return right if the face is normal along the -X axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: -1,
                            y: 0,
                            z: 0,
                        },
                    },
                } as any)
            ).toBe('right');
        });

        it('should return left if the face is normal along the X axis', () => {
            expect(
                calculateHitFace({
                    face: {
                        normal: {
                            x: 1,
                            y: 0,
                            z: 0,
                        },
                    },
                } as any)
            ).toBe('left');
        });
    });

    describe('calculateCubeSphereIntersection()', () => {
        it('should return an intersection if the given sphere is inside the given object', async () => {
            const obj = new Group();

            // Cube with a width, length, and height of 1
            obj.scale.set(1, 1, 1);
            obj.updateMatrixWorld();

            // Sphere with diameter of 0.5
            const sphere = new Sphere(new Vector3(0, 0, 0), 0.25);

            const intersection = calculateCubeSphereIntersection(obj, sphere);

            expect(intersection).toEqual({
                distance: -0.5, // Signed distance from center of sphere to point
                point: new Vector3(0.5, 0, 0),
                face: {
                    normal: new Vector3(1, 0, 0),
                },
                uv: new Vector2(0.5, 0.5),
                object: expect.any(Object),
            });
            expect(intersection.object).toBe(obj);
        });

        it('should support rotated objects', async () => {
            const obj = new Group();

            // Cube with a width, length, and height of 1
            obj.scale.set(1, 1, 1);

            // 45 degrees around Z axis
            obj.setRotationFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4);
            obj.updateMatrixWorld();

            // Sphere with diameter of 0.5
            const sphere = new Sphere(new Vector3(0.75, 0, 0), 0.25);

            const intersection = calculateCubeSphereIntersection(obj, sphere);

            expect(intersection).not.toBe(null);
            expect(intersection.distance).toBeCloseTo(0.04);
            expect(intersection.point.x).toBeCloseTo(0.707);
            expect(intersection.point.y).toBeCloseTo(0);
            expect(intersection.face).toEqual({
                normal: new Vector3(1, 0, 0),
            });
            expect(intersection.uv).toEqual(new Vector2(0, 0.5));
        });

        it('should support non-uniform scales', async () => {
            const obj = new Group();

            // Cube with a width, length, and height of 1
            obj.scale.set(2, 1, 1);
            obj.updateMatrixWorld();

            // Sphere with diameter of 0.5
            const sphere = new Sphere(new Vector3(1, 0, 0), 0.25);

            const intersection = calculateCubeSphereIntersection(obj, sphere);

            expect(intersection).toEqual({
                distance: -0, // Signed distance from center of sphere to point
                point: new Vector3(1, 0, 0),
                face: {
                    normal: new Vector3(1, 0, 0),
                },
                uv: new Vector2(0.5, 0.5),
                object: expect.any(Object),
            });
        });

        it('should return an intersection if the given sphere contains the given object', async () => {
            const obj = new Group();

            // Cube with a width, length, and height of 1
            obj.scale.set(1, 1, 1);
            obj.updateMatrixWorld();

            // Sphere with diameter of 0.5
            const sphere = new Sphere(new Vector3(0, 0, 0), 10);

            const intersection = calculateCubeSphereIntersection(obj, sphere);

            expect(intersection).toEqual({
                distance: -0.5, // Signed distance from center of sphere to point
                point: new Vector3(0.5, 0, 0),
                face: {
                    normal: new Vector3(1, 0, 0),
                },
                uv: new Vector2(0.5, 0.5),
                object: expect.any(Object),
            });
            expect(intersection.object).toBe(obj);
        });

        it('should return null if the sphere does not intersect with the cube', async () => {
            const obj = new Group();

            // Cube with a width, length, and height of 1
            obj.scale.set(1, 1, 1);
            obj.updateMatrixWorld();

            const sphere = new Sphere(new Vector3(5, 0, 0), 0.5);

            const intersection = calculateCubeSphereIntersection(obj, sphere);

            expect(intersection).toEqual(null);
        });

        describe('faces', () => {
            const cases = [
                [
                    'front',
                    new Sphere(new Vector3(0, 0.75, 0), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(0, 0.5, 0),
                        face: {
                            normal: new Vector3(0, 1, 0),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
                [
                    'rear',
                    new Sphere(new Vector3(0, -0.75, 0), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(0, -0.5, 0),
                        face: {
                            normal: new Vector3(0, -1, 0),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
                [
                    'left',
                    new Sphere(new Vector3(-0.75, 0, 0), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(-0.5, 0, 0),
                        face: {
                            normal: new Vector3(-1, 0, 0),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
                [
                    'right',
                    new Sphere(new Vector3(0.75, 0, 0), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(0.5, 0, 0),
                        face: {
                            normal: new Vector3(1, 0, 0),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
                [
                    'top',
                    new Sphere(new Vector3(0, 0, 0.75), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(0, 0, 0.5),
                        face: {
                            normal: new Vector3(0, 0, 1),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
                [
                    'bottom',
                    new Sphere(new Vector3(0, 0, -0.75), 0.5),
                    {
                        distance: 0.25,
                        point: new Vector3(0, 0, -0.5),
                        face: {
                            normal: new Vector3(0, 0, -1),
                        },
                        uv: new Vector2(0.5, 0.5),
                    },
                ] as const,
            ];

            it.each(cases)('%s', (face, sphere, expected) => {
                const obj = new Group();

                // Cube with a width, length, and height of 1
                obj.scale.set(1, 1, 1);
                obj.updateMatrixWorld();

                const intersection = calculateCubeSphereIntersection(
                    obj,
                    sphere
                );

                expect(intersection).toEqual({
                    ...expected,
                    object: expect.any(Object),
                });
                expect(intersection.object).toBe(obj);
            });

            const uvCases = [] as [string, Sphere, Vector2][];
            for (let [face, sphere, expected] of cases) {
                uvCases.push([
                    `${face}-top-right`,
                    new Sphere(
                        fillVector(sphere.center, 0.4, 0.4),
                        sphere.radius
                    ),
                    new Vector2(0.9, 0.9),
                ]);
                uvCases.push([
                    `${face}-top-left`,
                    new Sphere(
                        fillVector(sphere.center, -0.4, 0.4),
                        sphere.radius
                    ),
                    new Vector2(0.1, 0.9),
                ]);
                uvCases.push([
                    `${face}-bottom-right`,
                    new Sphere(
                        fillVector(sphere.center, 0.4, -0.4),
                        sphere.radius
                    ),
                    new Vector2(0.9, 0.1),
                ]);
                uvCases.push([
                    `${face}-bottom-left`,
                    new Sphere(
                        fillVector(sphere.center, -0.4, -0.4),
                        sphere.radius
                    ),
                    new Vector2(0.1, 0.1),
                ]);

                function fillVector(vector: Vector3, x: number, y: number) {
                    if (Math.abs(vector.x) > 0) {
                        return new Vector3(vector.x, x, y);
                    } else if (Math.abs(vector.y) > 0) {
                        return new Vector3(x, vector.y, y);
                    } else {
                        return new Vector3(x, y, vector.z);
                    }
                }
            }

            describe('UVs', () => {
                it.each(uvCases)('%s', (face, sphere, expected) => {
                    const obj = new Group();

                    // Cube with a width, length, and height of 1
                    obj.scale.set(1, 1, 1);
                    obj.updateMatrixWorld();

                    const intersection = calculateCubeSphereIntersection(
                        obj,
                        sphere
                    );

                    if (intersection.uv) {
                        expect(intersection.uv.x).toBeCloseTo(expected.x);
                        expect(intersection.uv.y).toBeCloseTo(expected.y);
                    } else {
                        expect(null).toEqual(expected);
                    }
                });
            });
        });
    });
});
