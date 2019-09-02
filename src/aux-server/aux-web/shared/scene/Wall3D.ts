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
import { disposeMaterial, baseAuxMeshMaterial } from './SceneUtils';

export class Wall3D extends Object3D {
    public static DefaultColor: Color = new Color(1, 1, 1);
    public static DefaultHeadWidth = 0.15;
    public static DefaultHeadLength = 0.3;

    /**
     * The wall object that will be rendered.
     */
    private _wallObject: Mesh;

    /**
     * The file that this wall is coming from.
     */
    private _sourceFile3d: AuxFile3D;

    /**
     * The file that this wall is pointing towards.
     */
    private _targetFile3d: AuxFile3D;

    private lastScale: number;
    private lastWidth: number;
    private lastDir: Vector3;
    private lastSourceDir: Vector3;
    private lastSourceWorkspace: Vector3;
    private lastTargetWorkspace: Vector3;
    private rebuildCount = 2;

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
     * Set the origin of the wall.
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
            // The workspace of both the source file and target file are minimized. Hide wall and do nothing else.
            this._wallObject.visible = false;
        } else {
            this._wallObject.visible = true;

            // Update wall origin.
            if (sourceWorkspace instanceof BuilderGroup3D && sourceMinimized) {
                let miniHexSphere =
                    sourceWorkspace.surface.miniHex.boundingSphere;
                this.setOrigin(miniHexSphere.center, true);
            } else {
                let sourceSphere = this._sourceFile3d.boundingSphere;
                this.setOrigin(sourceSphere.center, true);
            }

            // Update wall direction and length.
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

            // gets the grid position of the bot
            let targetY = this._targetFile3d.display.position.y;

            let sourceHeight =
                this._sourceFile3d.boundingBox.max.y -
                sourceWorkspace.position.y;

            // still need to fix height and y positioning issues,
            // is still starts the y on the 0 and not on y position
            // then has the height go too far with it

            let sourceY = this._sourceFile3d.display.position.y;

            let width: number = this._sourceFile3d.file.tags['aux.line.width'];

            if (
                width === this.lastWidth &&
                this.lastDir != undefined &&
                dir.equals(this.lastDir) &&
                this.lastSourceDir != undefined &&
                this.sourceFile3d.position.equals(this.lastSourceDir) &&
                this.lastScale != undefined &&
                sourceHeight === this.lastScale &&
                this.lastSourceWorkspace != undefined &&
                this.lastSourceWorkspace.equals(sourceWorkspace.position) &&
                this.lastTargetWorkspace != undefined &&
                this.lastTargetWorkspace.equals(targetWorkspace.position)
            ) {
                if (this.rebuildCount > 0) {
                    this.rebuildCount--;
                } else {
                    return;
                }
            } else {
                if (this.rebuildCount <= 0) {
                    this.rebuildCount = 2;
                }
            }

            // double update the file's position to move the wall correctly
            let x = this._targetFile3d.display.position.x;
            let y = this._targetFile3d.display.position.z;

            sourceWorkspace.simulation3D.simulation.helper.updateFile(
                this.targetFile3d.file,
                {
                    tags: {
                        [`aux.context.x`]: x + 0.001,
                        [`aux.context.y`]: y + 0.001,
                    },
                }
            );

            sourceWorkspace.simulation3D.simulation.helper.updateFile(
                this.targetFile3d.file,
                {
                    tags: {
                        [`aux.context.x`]: x,
                        [`aux.context.y`]: y,
                    },
                }
            );

            x = this._sourceFile3d.display.position.x;
            y = this._sourceFile3d.display.position.z;

            // use this instead of updating thses files here to clean up this function
            //sourceWorkspace.simulation3D.ensureUpdate

            sourceWorkspace.simulation3D.simulation.helper.updateFile(
                this._sourceFile3d.file,
                {
                    tags: {
                        [`aux.context.x`]: x + 0.001,
                        [`aux.context.y`]: y + 0.001,
                    },
                }
            );

            sourceWorkspace.simulation3D.simulation.helper.updateFile(
                this._sourceFile3d.file,
                {
                    tags: {
                        [`aux.context.x`]: x,
                        [`aux.context.y`]: y,
                    },
                }
            );

            this.lastWidth = width;
            this.lastDir = dir;
            this.lastSourceDir = this.sourceFile3d.position;
            this.lastScale = sourceHeight;
            this.lastSourceWorkspace = sourceWorkspace.position.clone();
            this.lastTargetWorkspace = targetWorkspace.position.clone();

            var geometry = new BufferGeometry();

            if (width === undefined || width <= 0) {
                // if width is null or 0

                let vertices = new Float32Array([
                    dir.x,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z,
                    0.0,
                    -(sourceHeight / 2 - sourceY / 2),
                    0,
                    0.0,
                    sourceHeight / 2 - sourceY / 2,
                    0,

                    0.0,
                    sourceHeight / 2 - sourceY / 2,
                    0,
                    dir.x,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        sourceWorkspace.position.y,
                    dir.z,
                    dir.x,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z,
                ]);

                // itemSize = 3 because there are 3 values (components) per vertex
                geometry.addAttribute(
                    'position',
                    new BufferAttribute(vertices, 3)
                );

                if (this._wallObject.geometry != null) {
                    this._wallObject.geometry.dispose();
                }

                this._wallObject.geometry = geometry;
            } else {
                var angleDeg =
                    (Math.atan2(dir.z - 0, dir.x - 0) * 180) / Math.PI;

                let zChange = 1 - angleDeg / 90;
                let xChange = 1 - Math.abs(zChange);

                let vertices = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);

                if (angleDeg < -90) {
                    zChange = -(1 - Math.abs(angleDeg + 90) / 90);
                    xChange = xChange / 2;
                } else {
                    zChange = 1 - Math.abs(angleDeg) / 90;
                }

                // if width is greater than 0
                vertices = new Float32Array([
                    dir.x + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z - (width / 50) * zChange,
                    0.0 + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 - (width / 50) * zChange,
                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,
                    dir.x + (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z - (width / 50) * zChange,
                    dir.x + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z - (width / 50) * zChange,

                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 + (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 + (width / 50) * zChange,

                    0.0 - (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2,
                    0 + (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z + (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 + (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z + (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,
                    dir.x + (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z - (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z + (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 - (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 + (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 - (width / 50) * zChange,
                    dir.x + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z - (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 - (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 + (width / 50) * zChange,
                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,

                    0.0 + (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 - (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    sourceHeight / 2 - sourceY / 2 - 0.001,
                    0 + (width / 50) * zChange,
                    0.0 - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2),
                    0 + (width / 50) * zChange,

                    dir.x + (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z - (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,
                    dir.x + (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z - (width / 50) * zChange,

                    dir.x + (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z - (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    -(sourceHeight / 2 - sourceY / 2) +
                        (targetY - 0.1) -
                        (sourceY - 0.1),
                    dir.z + (width / 50) * zChange,
                    dir.x - (width / 50) * xChange,
                    this._targetFile3d.boundingBox.max.y -
                        sourceHeight / 2 -
                        sourceY / 2 -
                        0.001,
                    dir.z + (width / 50) * zChange,
                ]);

                // itemSize = 3 because there are 3 values (components) per vertex
                geometry.addAttribute(
                    'position',
                    new BufferAttribute(vertices, 3)
                );
                geometry.computeVertexNormals();
                geometry.normalizeNormals();
                //var material = new MeshBasicMaterial( { color: 0xff0000 } );

                if (this._wallObject.geometry != null) {
                    this._wallObject.geometry.dispose();
                }
                this._wallObject.geometry = geometry;
            }

            //this._wallObject.material = baseAuxMeshMaterial();
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

            let radians = Math.atan2(dir.y - 0, dir.x - 0);

            this._wallObject.quaternion.setFromAxisAngle(axis, radians);
            this._wallObject.setRotationFromEuler(
                new Euler(0, this._wallObject.rotation.y, 0)
            );
        }
    }

    public dispose() {
        this._sourceFile3d = null;
        this._targetFile3d = null;
    }

    private _getWorkspace(file3d: AuxFile3D): ContextGroup3D {
        return file3d.contextGroup;
    }
}
