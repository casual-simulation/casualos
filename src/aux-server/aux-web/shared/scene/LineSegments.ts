import {
    Object3D,
    Color,
    Vector3,
    Sphere,
    Mesh,
} from '@casual-simulation/three';

import { Line2 } from '@casual-simulation/three/examples/jsm/lines/Line2';
import { LineGeometry } from '@casual-simulation/three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';

import { disposeMaterial, buildSRGBColor } from './SceneUtils';
import { Arrow3D } from './Arrow3D';

export class LineSegments extends Object3D {
    private _meshes: Line2[] = [];
    private _meshLines: LineGeometry[] = [];
    private _lineMaterial: LineMaterial;
    private _lines: number[] = [];

    get material() {
        return this._lineMaterial;
    }

    constructor(lines: number[]) {
        super();

        this._lineMaterial = new LineMaterial();
        this._lineMaterial.color = Arrow3D.DefaultColor.clone();
        this._lineMaterial.toneMapped = false;
        this._lineMaterial.linewidth = Arrow3D.DefaultLineWidth;
        this._lines = lines;

        let meshLine = new LineGeometry();

        for (let i = 0; i + 5 < lines.length; i += 6) {
            let [x1, y1, z1, x2, y2, z2] = lines.slice(i, i + 6);

            let vec1 = new Vector3(x1, y1, z1);
            let vec2 = new Vector3(x2, y2, z2);
            let dir = vec2.clone().sub(vec1);

            dir.normalize();
            dir.multiplyScalar(this._lineMaterial.linewidth);

            let meshLine = new LineGeometry();
            meshLine.setPositions(
                [
                    x1,
                    y1,
                    z1,
                    x2,
                    y2,
                    z2,
                ],
            );
            let mesh = new Line2(meshLine, this._lineMaterial);
            mesh.matrixAutoUpdate = false;
            this._meshLines.push(meshLine);
            this._meshes.push(mesh);
            this.add(mesh);
        }
    }

    public setLineWidth(width: number) {
        this._lineMaterial.linewidth = width * Arrow3D.DefaultLineWidth;
        this._updateLines();
    }

    public setColor(color: number | Color) {
        this._lineMaterial.color = new Color(color);
    }

    public dispose() {
        for (let i = 0; i < this._meshes.length; i++) {
            let mesh = this._meshes[0];
            this.remove(mesh);
            mesh.geometry.dispose();
        }
        disposeMaterial(this._lineMaterial);
        this._meshes = null;
        this._meshLines = null;
        this._lineMaterial = null;
    }

    private _updateLines() {
        for (let i = 0; i + 5 < this._lines.length; i += 6) {
            let [x1, y1, z1, x2, y2, z2] = this._lines.slice(i, i + 6);

            let index = i / 6;
            let meshLine = this._meshLines[index];

            let vec1 = new Vector3(x1, y1, z1);
            let vec2 = new Vector3(x2, y2, z2);
            let dir = vec2.clone().sub(vec1);

            dir.normalize();
            dir.multiplyScalar(this._lineMaterial.linewidth);

            meshLine.setPositions(
                [
                    x1,
                    y1,
                    z1,
                    x2,
                    y2,
                    z2,
                ],
            );
        }
        this.updateMatrix();
    }
}
