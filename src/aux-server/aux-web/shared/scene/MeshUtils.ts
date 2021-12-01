import { LineSegments } from './LineSegments';
import { flatMap } from 'lodash';

export function createCubeStroke() {
    const lines = new LineSegments(createCubeStrokeLines());
    return lines;
}

function createCubeStrokeLines(): number[] {
    let verticies: number[][] = [
        [-0.5, -0.5, -0.5], // left  bottom back  - 0
        [0.5, -0.5, -0.5], // right bottom back  - 1
        [-0.5, 0.5, -0.5], // left  top    back  - 2
        [0.5, 0.5, -0.5], // right top    back  - 3
        [-0.5, -0.5, 0.5], // left  bottom front - 4
        [0.5, -0.5, 0.5], // right bottom front - 5
        [-0.5, 0.5, 0.5], // left  top    front - 6
        [0.5, 0.5, 0.5], // right top    front - 7
    ];

    const indicies = [
        0, 1, 0, 2, 0, 4, 4, 5, 4, 6, 5, 7, 5, 1, 1, 3, 2, 3, 2, 6, 3, 7, 6, 7,
    ];
    const lines: number[] = flatMap(indicies, (i) => verticies[i]);
    return lines;
}
