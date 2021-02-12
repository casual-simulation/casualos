import {
    createBot,
    createPrecalculatedContext,
} from '@casual-simulation/aux-common';
import { calculateScale, createCube, percentOfScreen } from './SceneUtils';
import {
    Box3,
    PerspectiveCamera,
    OrthographicCamera,
    Sphere,
    Camera,
    Mesh,
    Vector3,
} from 'three';

describe('SceneUtils', () => {
    describe('calculateScale()', () => {
        it('should swap the Y and Z values', () => {
            const bot = createBot('bot', {
                scaleX: 2,
                scaleY: 3,
                scaleZ: 4,
            });
            const calc = createPrecalculatedContext([bot]);

            const scale = calculateScale(calc, bot, 2);
            expect(scale.x).toEqual(4);
            expect(scale.y).toEqual(8);
            expect(scale.z).toEqual(6);
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
            expect(scale.y).toEqual(8);
            expect(scale.z).toEqual(6);
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
});
