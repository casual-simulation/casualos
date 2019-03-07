import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateFileValue } from "@yeti-cgi/aux-common";
import { Mesh, MeshStandardMaterial, Color, LineSegments, BufferGeometry, BufferAttribute, LineBasicMaterial, Group } from "three";
import { createCube, createCubeStrokeGeometry } from "../SceneUtils";
import { flatMap } from "lodash";

export class MeshCubeDecorator implements AuxFile3DDecorator {

    container: Group;

    cube: Mesh;

    /**
     * The optional stroke outline for the file.
     */
    stroke: LineSegments;

    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {

        // Container
        if (!this.container) {
            this.container = new Group();
            this.container.position.set(0, .5, 0);
            file3D.display.add(this.container);
        }

        // Cube Mesh
        if (!this.cube) {
            this.cube = createCube(1);
            this.container.add(this.cube);
            file3D.colliders.push(this.cube);
        }

        // Color
        if (file3D.file.tags.color) {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = new Color(file3D.file.tags.color);
        } else {
            const material = <MeshStandardMaterial>this.cube.material;
            material.color = new Color(0xFFFFFF);
        }

        // Stroke
        if (!this.stroke) {
            // Create the stroke mesh
            const geo = createCubeStrokeGeometry();
            const material = new LineBasicMaterial({
                color: 0x000000
            });
            
            this.stroke = new LineSegments(geo, material);
            this.container.add(this.stroke);
        }

        this.stroke.visible = true;
        const colorValue = calculateFileValue(calc, file3D.file, 'stroke.color');
        const width:number = calculateFileValue(calc, file3D.file, 'stroke.width');

        const material = <LineBasicMaterial>this.stroke.material;
        if (typeof colorValue !== 'undefined') {
            material.color = new Color(colorValue);
        } else {
            material.color = new Color(0x999999);
        }

        if(typeof width !== 'undefined'){
            material.linewidth = width;
        } else {
            material.linewidth = 1;
        }
    }

    frameUpdate(): void {
    }

    dispose(): void {
        // cube mesh will get removed when AuxFile3D finishes disposing itself.
    }
}