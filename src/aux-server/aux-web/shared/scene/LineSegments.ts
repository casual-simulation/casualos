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

        for (let i = 0; i + 5 < lines.length; i += 6) {
            let points = lines.slice(i, i + 6);

            let meshLine = new MeshLine();
            meshLine.setPoints(points);
            let mesh = new Mesh(meshLine, this._lineMaterial);
            mesh.matrixAutoUpdate = false;
            this._meshLines.push(meshLine);
            this._meshes.push(mesh);
            this.add(mesh);
        }
    }

    public setLineWidth(width: number) {
        this._lineMaterial.lineWidth = width * Arrow3D.DefaultLineWidth;
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
}
