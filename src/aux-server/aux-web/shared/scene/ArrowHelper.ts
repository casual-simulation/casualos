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

// Modified to utilize Line2

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

import { Line2 } from '@casual-simulation/three/examples/jsm/lines/Line2';
import { LineGeometry } from '@casual-simulation/three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';

const _axis = /*@__PURE__*/ new Vector3();
let _coneGeometry: CylinderGeometry;

export class ArrowHelper extends Object3D {
    line: Line2;
    lineMaterial: LineMaterial;
    cone: Mesh;
    coneMaterial: MeshBasicMaterial;

    meshLine: LineGeometry;

    private _currentLength: number;
    private _currentHeadLength: number;

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

        this.meshLine = new LineGeometry();
        this.lineMaterial = new LineMaterial();
        this.lineMaterial.color = new Color(color);
        this.lineMaterial.toneMapped = false;
        this.lineMaterial.linewidth = 1;
        this.lineMaterial.fog = false;

        this.line = new Line2(this.meshLine, this.lineMaterial);
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

        if (this._currentLength !== length || this._currentHeadLength !== headLength) {
            this._currentHeadLength = headLength;
            this._currentLength = length;
            let points = [0, 0, 0, 0, Math.max(0.0001, length - headLength), 0];
            this.meshLine.setPositions(points);
            this.line.updateMatrix();
        }

        this.cone.scale.set(headWidth, headLength, headWidth);
        this.cone.position.y = length;
        this.cone.updateMatrix();
    }

    setLineWidth(width: number) {
        this.lineMaterial.linewidth = width;
    }

    setColor(color: number | Color) {
        this.lineMaterial.color.set(color);
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
