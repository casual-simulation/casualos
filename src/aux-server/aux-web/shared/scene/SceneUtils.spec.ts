import {
    createBot,
    createCalculationContext,
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
import flatMap from 'lodash/flatMap';

describe('SceneUtils', () => {
    describe('calculateScale()', () => {
        it('should swap the Y and Z values', () => {
            const bot = createBot('bot', {
                auxScaleX: 2,
                auxScaleY: 3,
                auxScaleZ: 4,
            });
            const calc = createCalculationContext([bot]);

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

            const boxArea2D = cubeSize * cubeSize;
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

            it('should return the approximate size of the given bounding box on the screen', () => {
                const box = new Box3().setFromObject(cube);

                const percent = percentOfScreen(camera, box);

                expect(percent).toBeCloseTo(boxArea2D / areaOfScreen, 6);
            });

            describe('clipping', () => {
                const leftEdge = new Vector3(left, 0, 0);
                const rightEdge = new Vector3(right, 0, 0);
                const topEdge = new Vector3(0, top, 0);
                const bottomEdge = new Vector3(0, bottom, 0);

                const namedEdges = [
                    ['left', leftEdge],
                    ['right', rightEdge],
                    ['top', topEdge],
                    ['bottom', bottomEdge],
                ] as const;

                const singleEdgeCases = namedEdges.map(([name, pos]) => [
                    `${name} edge`,
                    pos,
                    boxArea2D / 2,
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
                    boxArea2D / 4,
                ]);

                const clippingCases = [...singleEdgeCases, ...twoEdgeCases];

                it.each(clippingCases)(
                    'should handle clipping the %s of the projection',
                    (desc: string, pos: Vector3, area: number) => {
                        cube.position.copy(pos);
                        const box = new Box3().setFromObject(cube);

                        const percent = percentOfScreen(camera, box);

                        expect(percent).toBeCloseTo(area / areaOfScreen, 6);
                    }
                );
            });
        });
    });
});
