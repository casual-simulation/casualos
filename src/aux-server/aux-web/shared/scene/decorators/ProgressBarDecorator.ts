import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import {
    FileCalculationContext,
    calculateNumericalTagValue,
    calculateFileValue,
    getFileShape,
    FileShape,
} from '@casual-simulation/aux-common';
import {
    Mesh,
    MeshStandardMaterial,
    Color,
    LineSegments,
    LineBasicMaterial,
    Group,
    Vector3,
    MeshToonMaterial,
    Sprite,
} from 'three';
import {
    createCube,
    createCubeStrokeGeometry,
    isTransparent,
    disposeMesh,
    createSphere,
    createSprite,
    createPlane,
    setLayer,
} from '../SceneUtils';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { LayersHelper } from '../LayersHelper';

export class ProgressBarDecorator extends AuxFile3DDecorator
    implements IMeshDecorator {
    private _shape: FileShape = 'sprite';

    container: Group;
    mesh: Mesh;
    meshBackground: Mesh;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    progressNum: number;
    progressBarHeight = 0.2;

    constructor(file3D: AuxFile3D) {
        super(file3D);

        this._rebuildBar();
    }

    fileUpdated(calc: FileCalculationContext): void {
        if (this.mesh) {
            this.dispose();
        }

        // for cleanup purposes we'll stop the update, maybe remove/hide it if no progressbar tag
        if (!this.file3D.file.tags['aux.progressBar']) {
            return;
        } else {
            this.progressNum = calculateNumericalTagValue(
                calc,
                this.file3D.file,
                'aux.progressBar',
                null
            );

            if (this.progressNum === null) {
                return;
            } else {
                if (this.progressNum > 1) {
                    this.progressNum = 1;
                } else if (this.progressNum < 0) {
                    this.progressNum = 0;
                }
            }
        }

        const shape = getFileShape(calc, this.file3D.file);
        if (this._shape !== shape) {
            this._rebuildBar();
        }

        this._updateColor(calc);
        this._updateFill(calc);

        this.file3D.display.updateMatrixWorld(false);
    }

    frameUpdate(calc: FileCalculationContext): void {}

    dispose(): void {
        const index = this.file3D.colliders.indexOf(this.mesh);
        if (index >= 0) {
            this.file3D.colliders.splice(index, 1);
        }

        this.file3D.display.remove(this.container);
        disposeMesh(this.mesh);

        this.mesh = null;
        this.container = null;
    }

    private _updateColor(calc: FileCalculationContext) {
        let color: any = null;
        if (this.file3D.file.tags['aux.progressBar.color']) {
            color = calculateFileValue(
                calc,
                this.file3D.file,
                'aux.progressBar.color'
            );
        }

        let colorBackground: any = null;
        if (this.file3D.file.tags['aux.progressBar.backgroundColor']) {
            colorBackground = calculateFileValue(
                calc,
                this.file3D.file,
                'aux.progressBar.backgroundColor'
            );
        }

        this._setColor(color, colorBackground);
    }

    private _updateFill(calc: FileCalculationContext) {
        // width, height. unused depth

        this.mesh.scale.set(this.progressNum, this.progressBarHeight, 1);
        //this.mesh.position.set(0,4,2);
        this.mesh.position.set((-1 + this.progressNum) / 2, 0, 0.001);

        this.meshBackground.scale.set(1, this.progressBarHeight, 1);
    }

    private _setColor(color: any, colorBackground: any) {
        const shapeMat = <MeshStandardMaterial | MeshToonMaterial>(
            this.mesh.material
        );
        if (color) {
            shapeMat.visible = !isTransparent(color);
            if (shapeMat.visible) {
                shapeMat.color = new Color(color);
            }
        } else {
            shapeMat.visible = true;
            shapeMat.color = new Color(0x000000);
        }

        const shapeMatBackground = <MeshStandardMaterial | MeshToonMaterial>(
            this.meshBackground.material
        );

        if (colorBackground) {
            shapeMatBackground.visible = !isTransparent(colorBackground);
            if (shapeMatBackground.visible) {
                shapeMatBackground.color = new Color(colorBackground);
            }
        } else {
            shapeMatBackground.visible = true;
            shapeMatBackground.color = new Color(0xffffff);
        }
    }

    private _rebuildBar() {
        if (this.mesh) {
            this.dispose();
        }

        // Container
        this.container = new Group();

        // , , less goes right
        this.container.position.set(0, 1.2, 0);
        this.file3D.display.add(this.container);

        this.meshBackground = createPlane(1);
        this.container.add(this.meshBackground);
        this.file3D.colliders.push(this.meshBackground);

        // Sprite Mesh if a sprite mesh is actually a plane geometrically
        this.mesh = createPlane(1);
        this.container.add(this.mesh);
        this.file3D.colliders.push(this.mesh);

        this.onMeshUpdated.invoke(this);
    }
}
