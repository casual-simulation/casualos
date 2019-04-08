import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateFileValue, getFileShape, FileShape } from "@yeti-cgi/aux-common";
import { Mesh, MeshStandardMaterial, Color, LineSegments, BufferGeometry, BufferAttribute, LineBasicMaterial, Group, Vector3 } from "three";
import { createCube, createCubeStrokeGeometry, isTransparent, disposeMaterial, disposeMesh, createSphere } from "../SceneUtils";
import { flatMap } from "lodash";
import { getColorForTags } from "../ColorUtils";

export class MeshCubeDecorator extends AuxFile3DDecorator {

    private _shape: FileShape = null;

    container: Group;
    shape: Mesh;

    /**
     * The optional stroke outline for the file.
     */
    stroke: LineSegments;

    constructor(file3D: AuxFile3D) {
        super(file3D);

        this._rebuildShape('cube');
    }

    fileUpdated(calc: FileCalculationContext): void {

        const shape = getFileShape(calc, this.file3D.file);
        if (this._shape !== shape) {
            this._rebuildShape(shape);
        }

        this._updateColor(calc);
        this._updateStroke(calc);

        this.file3D.display.updateMatrixWorld(false);
    }

    private _updateStroke(calc: FileCalculationContext) {
        if (!this.stroke) {
            return;
        }

        this.stroke.visible = true;
        const strokeColorValue = calculateFileValue(calc, this.file3D.file, 'aux.stroke.color');
        const strokeWidth: number = calculateFileValue(calc, this.file3D.file, 'aux.stroke.width');
        const strokeMat = <LineBasicMaterial>this.stroke.material;
        if (typeof strokeColorValue !== 'undefined') {
            strokeMat.visible = !isTransparent(strokeColorValue);
            if (strokeMat.visible) {
                strokeMat.color = new Color(strokeColorValue);
            }
        } else {
            strokeMat.visible = true;
            strokeMat.color = new Color(0x999999);
        }
        if (typeof strokeWidth !== 'undefined') {
            strokeMat.linewidth = strokeWidth;
        } else {
            strokeMat.linewidth = 1;
        }
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
        const index = this.file3D.colliders.indexOf(this.shape);
        if (index >= 0) {
            this.file3D.colliders.splice(index, 1);
        }

        this.file3D.display.remove(this.container);
        disposeMesh(this.shape);
        disposeMesh(this.stroke);
        
        this.shape = null;
        this.container = null;
        this.stroke = null;
    }

    private _updateColor(calc: FileCalculationContext) {
        let color: any = null;
        if (this.file3D.file.tags['aux.color']) {
            color = calculateFileValue(calc, this.file3D.file, 'aux.color');
        } else if (this.file3D.file.tags['aux._diff'] && this.file3D.file.tags['aux._diffTags']) {
            color = getColorForTags(this.file3D.file.tags['aux._diffTags']);
        }

        this._setColor(color);
    }
    
    private _setColor(color: any) {
        const shapeMat = <MeshStandardMaterial>this.shape.material;
        if (color) {
            shapeMat.visible = !isTransparent(color);
            if (shapeMat.visible) {
                shapeMat.color = new Color(color);
            }
        } else {
            shapeMat.visible = true;
            shapeMat.color = new Color(0xFFFFFF);
        }
    }

    private _rebuildShape(shape: FileShape) {
        this._shape = shape;
        if (this.shape) {
            this.dispose();
        }

        this._createShape();
    }

    private _createShape() {
        // Container
        this.container = new Group();
        this.container.position.set(0, .5, 0);
        this.file3D.display.add(this.container);

        if (this._shape === 'cube') {
            // Cube Mesh
            this.shape = createCube(1);
            this.container.add(this.shape);
            this.file3D.colliders.push(this.shape);
            
            // Stroke
            const geo = createCubeStrokeGeometry();
            const material = new LineBasicMaterial({
                color: 0x000000
            });
            
            this.stroke = new LineSegments(geo, material);
            this.container.add(this.stroke);
        } else if (this._shape === 'sphere') {
            // Sphere Mesh
            this.shape = createSphere(new Vector3(0,0,0), 0x000000, 0.5);
            this.container.add(this.shape);
            this.file3D.colliders.push(this.shape);

            this.stroke = null;
        }
    }
}