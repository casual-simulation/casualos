import {
    createBot,
    createPrecalculatedContext,
} from '@casual-simulation/aux-common';
import {
    calculateScale,
    createCube,
    parseCasualOSUrl,
    percentOfScreen,
    calculateHitFace,
} from './SceneUtils';
import {
    Box3,
    PerspectiveCamera,
    OrthographicCamera,
    Sphere,
    Camera,
    Mesh,
    Vector3,
} from '@casual-simulation/three';
import { isTaggedNumber } from '@casual-simulation/aux-common/bots/BotCalculations';

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

    describe('parseCasualOSUrl()', () => {
        it('should return an object describing the CasualOS URL', () => {
            expect(parseCasualOSUrl('casualos://camera-feed')).toEqual({
                type: 'camera-feed',
            });

            expect(parseCasualOSUrl('casualos://camera-feed/front')).toEqual({
                type: 'camera-feed',
                camera: 'front',
            });

            expect(parseCasualOSUrl('casualos://camera-feed/rear')).toEqual({
                type: 'camera-feed',
                camera: 'rear',
            });

            expect(parseCasualOSUrl('casualos://camera-feed/other')).toEqual({
                type: 'camera-feed',
            });

            expect(
                parseCasualOSUrl('casualos://video-element/uuid-123-abc')
            ).toEqual({
                type: 'video-element',
                address: 'casualos://video-element/uuid-123-abc',
            });
        });

        // See https://bugs.chromium.org/p/chromium/issues/detail?id=869291
        // See https://bugzilla.mozilla.org/show_bug.cgi?id=1374505
        it('should support Chrome and Firefox URL results', () => {
            // How Chrome/Firefox parse casualos://camera-feed
            expect(
                parseCasualOSUrl({
                    protocol: 'casualos:',
                    hostname: '',
                    host: '',
                    pathname: '//camera-feed',
                })
            ).toEqual({
                type: 'camera-feed',
            });

            // How Chrome/Firefox parse casualos://camera-feed/front
            expect(
                parseCasualOSUrl({
                    protocol: 'casualos:',
                    hostname: '',
                    host: '',
                    pathname: '//camera-feed/front',
                })
            ).toEqual({
                type: 'camera-feed',
                camera: 'front',
            });

            // How Chrome/Firefox parse casualos://camera-feed/rear
            expect(
                parseCasualOSUrl({
                    protocol: 'casualos:',
                    hostname: '',
                    host: '',
                    pathname: '//camera-feed/rear',
                })
            ).toEqual({
                type: 'camera-feed',
                camera: 'rear',
            });

            // How Chrome/Firefox parse casualos://video-element/uuid-123-abc
            expect(
                parseCasualOSUrl({
                    protocol: 'casualos:',
                    hostname: '',
                    host: '',
                    pathname: '//video-element/uuid-123-abc',
                })
            ).toEqual({
                type: 'video-element',
                address: 'casualos://video-element/uuid-123-abc',
            });
        });

        it('should return null if given a non CasualOS URL', () => {
            expect(parseCasualOSUrl('http://example.com')).toBe(null);
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
});
