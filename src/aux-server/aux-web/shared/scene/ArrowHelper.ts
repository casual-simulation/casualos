// The MIT License

// Copyright © 2010-2021 three.js authors

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// Modified to utilize three.meshline (https://github.com/spite/THREE.MeshLine/tree/v1.3.0)

import {
    Float32BufferAttribute,
    BufferGeometry,
    Object3D,
    CylinderGeometry,
    MeshBasicMaterial,
    LineBasicMaterial,
    Mesh,
    Line,
    Vector3,
    Color,
} from '@casual-simulation/three';
import { MeshLine, MeshLineMaterial } from 'three.meshline';

const _axis = /*@__PURE__*/ new Vector3();
// let _lineGeometry: BufferGeometry;
let _coneGeometry: CylinderGeometry;

export class ArrowHelper extends Object3D {
    line: Mesh;
    lineMaterial: MeshLineMaterial;
    cone: Mesh;
    coneMaterial: MeshBasicMaterial;

    meshLine: MeshLine;

    constructor(
        dir?: Vector3,
        origin?: Vector3,
        length?: number,
        color?: number,
        headLength?: number,
        headWidth?: number,
        lineWidth?: number
    ) {
        super();
        // dir is assumed to be normalized

        this.type = 'ArrowHelper';

        if (dir === undefined) dir = new Vector3(0, 0, 1);
        if (origin === undefined) origin = new Vector3(0, 0, 0);
        if (length === undefined) length = 1;
        if (color === undefined) color = 0xffff00;
        if (headLength === undefined) headLength = 0.2 * length;
        if (headWidth === undefined) headWidth = 0.2 * headLength;

        if (_coneGeometry === undefined) {
            _coneGeometry = new CylinderGeometry(0, 0.5, 1, 5, 1);
            _coneGeometry.translate(0, -0.5, 0);
        }

        this.position.copy(origin);

        this.meshLine = new MeshLine();
        this.lineMaterial = new MeshLineMaterial();
        // this.lineMaterial.
        this.lineMaterial.color = new Color(color);
        this.lineMaterial.toneMapped = false;
        this.lineMaterial.sizeAttenuation = true;
        this.lineMaterial.lineWidth = 1;
        this.lineMaterial.fog = false;

        this.line = new Mesh(this.meshLine, this.lineMaterial);
        // this.line = new Line( _lineGeometry, new LineBasicMaterial( { color: color, toneMapped: false } ) );
        this.line.matrixAutoUpdate = false;
        this.add(this.line);

        this.coneMaterial = new MeshBasicMaterial({
            color: color,
            toneMapped: false,
        });
        this.cone = new Mesh(_coneGeometry, this.coneMaterial);
        this.cone.matrixAutoUpdate = false;
        this.add(this.cone);

        this.setDirection(dir);
        this.setLength(length, headLength, headWidth);
    }

    setDirection(dir: Vector3) {
        // dir is assumed to be normalized

        if (dir.y > 0.99999) {
            this.quaternion.set(0, 0, 0, 1);
        } else if (dir.y < -0.99999) {
            this.quaternion.set(1, 0, 0, 0);
        } else {
            _axis.set(dir.z, 0, -dir.x).normalize();

            const radians = Math.acos(dir.y);

            this.quaternion.setFromAxisAngle(_axis, radians);
        }
    }

    setLength(length: number, headLength: number, headWidth: number) {
        if (headLength === undefined) headLength = 0.2 * length;
        if (headWidth === undefined) headWidth = 0.2 * headLength;

        let points = [0, 0, 0, 0, Math.max(0.0001, length - headLength), 0];

        this.meshLine.setPoints(points);
        // this.line.scale.set( 1, , 1 ); // see #17458
        this.line.updateMatrix();

        this.cone.scale.set(headWidth, headLength, headWidth);
        this.cone.position.y = length;
        this.cone.updateMatrix();
    }

    setLineWidth(width: number) {
        this.lineMaterial.lineWidth = width;
    }

    setColor(color: number | Color) {
        this.lineMaterial.color.set(color);

        // Convert to SRGB manually because the MeshLineMaterial
        // does not convert the colors to the renderer output encoding.
        this.lineMaterial.color.convertLinearToSRGB();

        this.coneMaterial.color.set(color);
    }

    copy(source: this) {
        super.copy(source, false);

        this.line.copy(source.line);
        this.lineMaterial.copy(source.lineMaterial);
        this.meshLine.copy(source.meshLine);
        this.cone.copy(source.cone);
        this.coneMaterial.copy(source.coneMaterial);

        return this;
    }
}
