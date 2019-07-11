import {
    Object3D,
    Color,
    Vector3,
    ArrowHelper,
    Sphere,
    Plane,
    Mesh,
    PlaneGeometry,
    MeshBasicMaterial,
    DoubleSide,
    Quaternion,
    Euler,
    BufferGeometry,
    BufferAttribute,
} from 'three';

import {
    Object,
    isMinimized,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxFile3D } from './AuxFile3D';
import { ContextGroup3D } from './ContextGroup3D';
import { BuilderGroup3D } from './BuilderGroup3D';
import { disposeMaterial } from './SceneUtils';

export class Wall3D extends Object3D {
    public static DefaultColor: Color = new Color(1, 1, 1);
    public static DefaultHeadWidth = 0.15;
    public static DefaultHeadLength = 0.3;

    /**
     * Three JS helper that draws arrows.
     */
    private _wallObject: Mesh;

    /**
     * The file that this arrow is coming from.
     */
    private _sourceFile3d: AuxFile3D;

    /**
     * The file that this arrow is pointing towards.
     */
    private _targetFile3d: AuxFile3D;

    public get sourceFile3d() {
        return this._sourceFile3d;
    }
    public get targetFile3d() {
        return this._targetFile3d;
    }

    constructor(sourceFile3d: AuxFile3D, targetFile3d: AuxFile3D) {
        super();
        this._sourceFile3d = sourceFile3d;
        this._targetFile3d = targetFile3d;

        var geometry = new PlaneGeometry(5, 20);
        let material = new MeshBasicMaterial({
            color: Wall3D.DefaultColor.getHex(),
            side: DoubleSide,
        });

        this._wallObject = new Mesh(geometry, material);
        this.add(this._wallObject);
    }

    /**
     * Set the origin of the arrow.
     */
    public setOrigin(origin: Vector3, isWorldspace?: boolean) {
        if (isWorldspace) {
            this._wallObject.position.copy(this.worldToLocal(origin.clone()));
        } else {
            this._wallObject.position.copy(origin);
        }
    }

    public setColor(color?: Color) {
        if (!this._wallObject) return;

        if (color) {
            this._wallObject.material = new MeshBasicMaterial({
                color: color.getHex(),
                side: DoubleSide,
            });
        } else {
            this._wallObject.material = new MeshBasicMaterial({
                color: Wall3D.DefaultColor.getHex(),
                side: DoubleSide,
            });
        }
    }

    public setLength(length: number) {
        if (!this._wallObject) return;

        let headLength = Wall3D.DefaultHeadLength;
        let headWidth = Wall3D.DefaultHeadWidth;

        if (length < headLength) {
            headLength = undefined;
            headWidth = undefined;
        }

        //console.log("LLLLLLLLLLLLL: " + length);
        this._wallObject.geometry = new PlaneGeometry(length, 1);
        this._wallObject.geometry = new PlaneGeometry(length, 1);
    }

    public update(calc: FileCalculationContext) {
        if (!this._wallObject) return;

        let sourceWorkspace = this._getWorkspace(this._sourceFile3d);
        let targetWorkspace = this._getWorkspace(this._targetFile3d);

        const sourceMinimized =
            sourceWorkspace && isMinimized(calc, sourceWorkspace.file);
        const targetMinimized =
            targetWorkspace && isMinimized(calc, targetWorkspace.file);

        if (sourceMinimized && targetMinimized) {
            // The workspace of both the source file and target file are minimized. Hide arrow and do nothing else.
            this._wallObject.visible = false;
        } else {
            this._wallObject.visible = true;

            // Update arrow origin.
            if (sourceWorkspace instanceof BuilderGroup3D && sourceMinimized) {
                let miniHexSphere =
                    sourceWorkspace.surface.miniHex.boundingSphere;
                this.setOrigin(miniHexSphere.center, true);
            } else {
                let sourceSphere = this._sourceFile3d.boundingSphere;
                this.setOrigin(sourceSphere.center, true);
            }

            // Update arrow direction and length.
            let targetSphere: Sphere;

            // Lets get the bounding sphere of the target.
            // This could be either the sphere of the file itself or the sphere of the minimized workspace the file is on.
            if (targetWorkspace instanceof BuilderGroup3D && targetMinimized) {
                targetSphere = targetWorkspace.surface.miniHex.boundingSphere;
            } else {
                targetSphere = this._targetFile3d.boundingSphere;
            }

            let targetCenterLocal = this.worldToLocal(
                targetSphere.center.clone()
            );
            let dir = targetCenterLocal.clone().sub(this._wallObject.position);

            dir.setLength(dir.length());

            let length = dir.length();
            //Math.PI/2

            //this.setDirection(dir.normalize());

            //this._wallObject.setRotationFromEuler(new Euler(0, 0, 0));
            this.setLength(length);

            //console.log("UUUUUUUUUUUU: " + dir.x + "  ::  " + dir.z);

            var geometry = new BufferGeometry();
            // create a simple square shape. We duplicate the top left and bottom right
            // vertices because each vertex needs to appear once per triangle.
            let vertices = new Float32Array([
                dir.x,
                -0.2,
                dir.z,
                0.0,
                -0.2,
                0,
                0.0,
                0.2,
                0,

                0.0,
                0.2,
                0,
                dir.x,
                0.2,
                dir.z,
                dir.x,
                -0.2,
                dir.z,
            ]);

            // itemSize = 3 because there are 3 values (components) per vertex
            geometry.addAttribute('position', new BufferAttribute(vertices, 3));

            this._wallObject.geometry = geometry;
        }

        this.updateMatrixWorld(true);
    }

    setDirection(dir: Vector3) {
        let axis = new Vector3();

        if (dir.y > 0.99999) {
            this._wallObject.quaternion.set(0, 0, 0, 1);
        } else if (dir.y < -0.99999) {
            this._wallObject.quaternion.set(1, 0, 0, 0);
        } else {
            axis.set(dir.z, 0, -dir.x).normalize();

            let radians = Math.acos(dir.y);

            this._wallObject.quaternion.setFromAxisAngle(axis, radians);
            this._wallObject.setRotationFromEuler(
                new Euler(
                    this._wallObject.rotation.x,
                    this._wallObject.rotation.y,
                    0
                )
            );
            //console.log("MMMMMMMMMMMMMMM: " + this._wallObject.rotation.toArray());
        }
    }

    public dispose() {
        /*
        this.remove(this._wa);
        this._arrowHelper.line.geometry.dispose();
        disposeMaterial(this._arrowHelper.line.material);
        this._arrowHelper.cone.geometry.dispose();
        disposeMaterial(this._arrowHelper.cone.material);
        this._arrowHelper = null;
        */

        this._sourceFile3d = null;
        this._targetFile3d = null;
    }

    private _getWorkspace(file3d: AuxFile3D): ContextGroup3D {
        return file3d.contextGroup;
    }
}
