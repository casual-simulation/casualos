import {
    Object3D,
    Color,
    Vector3,
    Sphere,
    Mesh,
} from '@casual-simulation/three';

// @ts-ignore This import is not picked up by Jest
import { MeshLineMaterial, MeshLine } from 'three.meshline';
import { disposeMaterial, buildSRGBColor } from './SceneUtils';
import { Arrow3D } from './Arrow3D';

export class LineSegments extends Object3D {
    private _meshes: Mesh[] = [];
    private _meshLines: MeshLine[] = [];
    private _lineMaterial: MeshLineMaterial;
    private _lines: number[] = [];

    get material() {
        return this._lineMaterial;
    }

    constructor(lines: number[]) {
        super();

        this._lineMaterial = new MeshLineMaterial();
        this._lineMaterial.color = Arrow3D.DefaultColor.clone();
        this._lineMaterial.toneMapped = false;
        this._lineMaterial.sizeAttenuation = true;
        this._lineMaterial.lineWidth = Arrow3D.DefaultLineWidth;
        this._lines = lines;

        for (let i = 0; i + 5 < lines.length; i += 6) {
            let [x1, y1, z1, x2, y2, z2] = lines.slice(i, i + 6);

            let vec1 = new Vector3(x1, y1, z1);
            let vec2 = new Vector3(x2, y2, z2);
            let dir = vec2.clone().sub(vec1);

            dir.normalize();
            dir.multiplyScalar(this._lineMaterial.lineWidth);

            let meshLine = new MeshLine();
            meshLine.setPoints(
                [
                    x1 - dir.x,
                    y1 - dir.y,
                    z1 - dir.z,
                    x1,
                    y1,
                    z1,
                    x2,
                    y2,
                    z2,
                    x2 + dir.x,
                    y2 + dir.y,
                    z2 + dir.z,
                ],
                (p: number) => this._calculatePointWidth(p)
            );
            let mesh = new Mesh(meshLine, this._lineMaterial);
            mesh.matrixAutoUpdate = false;
            this._meshLines.push(meshLine);
            this._meshes.push(mesh);
            this.add(mesh);
        }
    }

    public setLineWidth(width: number) {
        this._lineMaterial.lineWidth = width * Arrow3D.DefaultLineWidth;
        this._updateLines();
    }

    public setColor(color: number | Color) {
        this._lineMaterial.color = new Color(color);
        this._lineMaterial.color.convertLinearToSRGB();
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
            dir.multiplyScalar(this._lineMaterial.lineWidth);

            meshLine.setPoints(
                [
                    x1 - dir.x,
                    y1 - dir.y,
                    z1 - dir.z,
                    x1,
                    y1,
                    z1,
                    x2,
                    y2,
                    z2,
                    x2 + dir.x,
                    y2 + dir.y,
                    z2 + dir.z,
                ],
                (p: number) => this._calculatePointWidth(p)
            );
        }
        this.updateMatrix();
    }

    private _calculatePointWidth(percent: number): number {
        if (percent === 0 || percent === 1) {
            return 0.25;
        }
        return 1;
    }
}
