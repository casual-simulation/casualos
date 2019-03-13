import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateFileValue } from "@yeti-cgi/aux-common";
import { Mesh, MeshStandardMaterial, Color, LineSegments, BufferGeometry, BufferAttribute, LineBasicMaterial, Group } from "three";
import { createCube, createCubeStrokeGeometry, isTransparent } from "../SceneUtils";
import { flatMap } from "lodash";

export class MeshCubeDecorator extends AuxFile3DDecorator {

    container: Group;

    cube: Mesh;

    /**
     * The optional stroke outline for the file.
     */
    stroke: LineSegments;

    constructor(file3D: AuxFile3D) {
        super(file3D);

        // Container
        this.container = new Group();
        this.container.position.set(0, .5, 0);
        this.file3D.display.add(this.container);

        // Cube Mesh
        this.cube = createCube(1);
        this.container.add(this.cube);
        this.file3D.colliders.push(this.cube);

        // Stroke
        const geo = createCubeStrokeGeometry();
        const material = new LineBasicMaterial({
            color: 0x000000
        });
        
        this.stroke = new LineSegments(geo, material);
        this.container.add(this.stroke);
    }

    fileUpdated(calc: FileCalculationContext): void {
        // Color
        const cubeMat = <MeshStandardMaterial>this.cube.material;
        if (this.file3D.file.tags['aux.color']) {
            const color = calculateFileValue(calc, this.file3D.file, 'aux.color');
            cubeMat.visible = !isTransparent(color);
            if (cubeMat.visible) {
                cubeMat.color = new Color(color);
            }
        } else {
            cubeMat.visible = true;
            cubeMat.color = new Color(0xFFFFFF);
        }

        this.stroke.visible = true;
        const strokeColorValue = calculateFileValue(calc, this.file3D.file, 'aux.stroke.color');
        const strokeWidth:number = calculateFileValue(calc, this.file3D.file, 'aux.stroke.width');

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

        if (typeof strokeWidth !== 'undefined'){
            strokeMat.linewidth = strokeWidth;
        } else {
            strokeMat.linewidth = 1;
        }

        this.file3D.display.updateMatrixWorld(false);
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
    }
}