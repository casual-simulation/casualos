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
import type { BufferAttribute } from '@casual-simulation/three';
import {
    BufferGeometry,
    LineBasicMaterial,
    Color,
    Vector3,
    Camera,
    PerspectiveCamera,
    LineSegments,
    Float32BufferAttribute,
} from '@casual-simulation/three';

const _vector = new Vector3();
const _camera = new Camera();

/**
 * Creates a camera frustum.
 */
export class FrustumHelper extends LineSegments {
    private camera: Camera;
    private pointMap: any;

    constructor() {
        super(
            new BufferGeometry(),
            new LineBasicMaterial({
                color: 0xffffff,
                vertexColors: true,
                toneMapped: false,
            })
        );
        const geometry = this.geometry as BufferGeometry;
        const material = this.material as LineBasicMaterial;

        const vertices = [] as number[];
        const colors = [] as number[];

        const pointMap = {} as any;

        // colors

        const colorFrustum = new Color(0xffffff);

        // near

        addLine('n1', 'n2', colorFrustum);
        addLine('n2', 'n4', colorFrustum);
        addLine('n4', 'n3', colorFrustum);
        addLine('n3', 'n1', colorFrustum);

        // far

        addLine('f1', 'f2', colorFrustum);
        addLine('f2', 'f4', colorFrustum);
        addLine('f4', 'f3', colorFrustum);
        addLine('f3', 'f1', colorFrustum);

        // sides

        addLine('n1', 'f1', colorFrustum);
        addLine('n2', 'f2', colorFrustum);
        addLine('n3', 'f3', colorFrustum);
        addLine('n4', 'f4', colorFrustum);

        // // cone

        // addLine('p', 'n1', colorCone);
        // addLine('p', 'n2', colorCone);
        // addLine('p', 'n3', colorCone);
        // addLine('p', 'n4', colorCone);

        // // up

        // addLine('u1', 'u2', colorUp);
        // addLine('u2', 'u3', colorUp);
        // addLine('u3', 'u1', colorUp);

        // // target

        // addLine('c', 't', colorTarget);
        // addLine('p', 'c', colorCross);

        // // cross

        // addLine('cn1', 'cn2', colorCross);
        // addLine('cn3', 'cn4', colorCross);

        // addLine('cf1', 'cf2', colorCross);
        // addLine('cf3', 'cf4', colorCross);

        function addLine(a: string, b: string, color: Color) {
            addPoint(a, color);
            addPoint(b, color);
        }

        function addPoint(id: any, color: Color) {
            vertices.push(0, 0, 0);
            colors.push(color.r, color.g, color.b);

            if (pointMap[id] === undefined) {
                pointMap[id] = [];
            }

            pointMap[id].push(vertices.length / 3 - 1);
        }

        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(vertices, 3)
        );
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

        (this as any).type = <any>'FrustumHelper';

        this.camera = new PerspectiveCamera(75, 1.3333333, 0.01, 1);
        if ((<any>this.camera).updateProjectionMatrix) {
            (<any>this.camera).updateProjectionMatrix();
        }

        this.matrix = this.camera.matrixWorld;
        this.matrixAutoUpdate = false;

        this.pointMap = pointMap;

        this.update();
    }

    update() {
        const geometry = this.geometry as BufferGeometry;
        const pointMap = this.pointMap;

        const w = 1,
            h = 1;

        // we need just camera projection matrix inverse
        // world matrix must be identity

        _camera.projectionMatrixInverse.copy(
            this.camera.projectionMatrixInverse
        );

        // center / target

        setPoint('c', pointMap, geometry, _camera, 0, 0, -1);
        setPoint('t', pointMap, geometry, _camera, 0, 0, 1);

        // near

        setPoint('n1', pointMap, geometry, _camera, -w, -h, -1);
        setPoint('n2', pointMap, geometry, _camera, w, -h, -1);
        setPoint('n3', pointMap, geometry, _camera, -w, h, -1);
        setPoint('n4', pointMap, geometry, _camera, w, h, -1);

        // far

        setPoint('f1', pointMap, geometry, _camera, -w, -h, 1);
        setPoint('f2', pointMap, geometry, _camera, w, -h, 1);
        setPoint('f3', pointMap, geometry, _camera, -w, h, 1);
        setPoint('f4', pointMap, geometry, _camera, w, h, 1);

        // up

        setPoint('u1', pointMap, geometry, _camera, w * 0.7, h * 1.1, -1);
        setPoint('u2', pointMap, geometry, _camera, -w * 0.7, h * 1.1, -1);
        setPoint('u3', pointMap, geometry, _camera, 0, h * 2, -1);

        // cross

        setPoint('cf1', pointMap, geometry, _camera, -w, 0, 1);
        setPoint('cf2', pointMap, geometry, _camera, w, 0, 1);
        setPoint('cf3', pointMap, geometry, _camera, 0, -h, 1);
        setPoint('cf4', pointMap, geometry, _camera, 0, h, 1);

        setPoint('cn1', pointMap, geometry, _camera, -w, 0, -1);
        setPoint('cn2', pointMap, geometry, _camera, w, 0, -1);
        setPoint('cn3', pointMap, geometry, _camera, 0, -h, -1);
        setPoint('cn4', pointMap, geometry, _camera, 0, h, -1);

        const positionAttr = geometry.getAttribute(
            'position'
        ) as BufferAttribute;
        geometry.rotateX(90 * (Math.PI / 180));
        positionAttr.needsUpdate = true;
    }
}

function setPoint(
    point: any,
    pointMap: any,
    geometry: BufferGeometry,
    camera: Camera,
    x: number,
    y: number,
    z: number
) {
    _vector.set(x, y, z).unproject(camera);
    const points = pointMap[point];

    if (points !== undefined) {
        const position = geometry.getAttribute('position');

        for (let i = 0, l = points.length; i < l; i++) {
            position.setXYZ(points[i], _vector.x, _vector.y, _vector.z);
        }
    }
}
