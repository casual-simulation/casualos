import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateNumericalTagValue,
    calculateBotValue,
    getBotShape,
    BotShape,
    BotLabelAnchor,
    clamp,
    hasValue,
    calculateStringTagValue,
    getBotTagAnchor,
} from '@casual-simulation/aux-common';
import {
    Mesh,
    MeshStandardMaterial,
    Color,
    Group,
    Vector3,
    Euler,
    MathUtils as ThreeMath,
    MeshToonMaterial,
} from '@casual-simulation/three';
import {
    isTransparent,
    disposeMesh,
    createPlane,
    calculateAnchorPosition,
    buildSRGBColor,
} from '../SceneUtils';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';

export class ProgressBarDecorator
    extends AuxBot3DDecoratorBase
    implements IMeshDecorator
{
    container: Group;
    mesh: Mesh;
    meshBackground: Mesh;

    progressValue: number;
    progressBarHeight = 0.2;
    color: any;
    bgColor: any;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    get allowModifications() {
        return true;
    }

    get allowMaterialModifications() {
        return true;
    }

    private _anchor: BotLabelAnchor = 'top';
    private _targetMeshDecorator: IMeshDecorator;

    constructor(bot3D: AuxBot3D, targetMeshDecorator: IMeshDecorator) {
        super(bot3D);
        this._targetMeshDecorator = targetMeshDecorator;

        this._handleTargetMeshUpdated =
            this._handleTargetMeshUpdated.bind(this);

        this._targetMeshDecorator.onMeshUpdated.addListener(
            this._handleTargetMeshUpdated
        );
    }

    botUpdated(calc: BotCalculationContext): void {
        let barTagValue = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxProgressBar',
            null
        );

        if (barTagValue === null || barTagValue === undefined) {
            if (this.mesh) {
                this.dispose();
            }
            return;
        }

        barTagValue = clamp(barTagValue, 0, 1);

        let anchorValue = getBotTagAnchor(
            calc,
            this.bot3D.bot,
            'auxProgressBarPosition'
        );

        // Flag that detected if the color values have changed.
        let colorsChanged = false;

        if (this.progressValue !== barTagValue) {
            this.progressValue = barTagValue;

            if (!this.mesh) {
                colorsChanged = true; // Mesh was rebuilt so we need to ensure that the colors are set
                this._rebuildBarMeshes();
            }

            this._updateFill();
        }

        if (this._anchor !== anchorValue) {
            this._anchor = anchorValue;

            if (!this.mesh) {
                colorsChanged = true; // Mesh was rebuilt so we need to ensure that the colors are set
                this._rebuildBarMeshes();
            } else {
                this._updatePosition();
            }
        }

        let colorTagValue: any = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxProgressBarColor'
        );
        if (hasValue(colorTagValue)) {
            if (this.color != colorTagValue) {
                this.color = colorTagValue;
                colorsChanged = true;
            }
        }

        let bgColorTagValue: any = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxProgressBarBackgroundColor'
        );
        if (hasValue(bgColorTagValue)) {
            if (this.bgColor != bgColorTagValue) {
                this.bgColor = bgColorTagValue;
                colorsChanged = true;
            }
        }

        if (colorsChanged) {
            this._updateColor();
        }
    }

    dispose(): void {
        this._destroyMeshes();

        if (this.container) {
            this.bot3D.display.remove(this.container);
        }
        this.container = null;

        this.progressValue = undefined;
        this.color = undefined;
        this.bgColor = undefined;
    }

    private _updateColor() {
        //
        // Progress bar color
        //
        const shapeMat = <MeshStandardMaterial | MeshToonMaterial>(
            this.mesh.material
        );
        if (this.color) {
            shapeMat.visible = !isTransparent(this.color);
            if (shapeMat.visible) {
                shapeMat.color = buildSRGBColor(this.color);
            }
        } else {
            shapeMat.visible = true;
            shapeMat.color = buildSRGBColor(0x000000);
        }

        //
        // Progress bar background color
        //
        const shapeMatBackground = <MeshStandardMaterial | MeshToonMaterial>(
            this.meshBackground.material
        );

        if (this.bgColor) {
            shapeMatBackground.visible = !isTransparent(this.bgColor);
            if (shapeMatBackground.visible) {
                shapeMatBackground.color = buildSRGBColor(this.bgColor);
            }
        } else {
            shapeMatBackground.visible = true;
            shapeMatBackground.color = buildSRGBColor(0xffffff);
        }
    }

    private _updateFill() {
        // width, height. unused depth
        this.mesh.scale.set(this.progressValue, this.progressBarHeight, 1);
        this.mesh.position.set((-1 + this.progressValue) / 2, 0, 0.001);

        this.meshBackground.scale.set(1, this.progressBarHeight, 1);
    }

    private _rebuildBarMeshes() {
        if (this.mesh) {
            this._destroyMeshes();
        }

        // Container
        this.container = new Group();

        // , , less goes right
        this.container.position.set(0, 1.2, 0);

        this.bot3D.display.add(this.container);

        this.meshBackground = createPlane(1);
        this.container.add(this.meshBackground);

        // Sprite Mesh if a sprite mesh is actually a plane geometrically
        this.mesh = createPlane(1);
        this.container.add(this.mesh);

        this._updatePosition();

        this.onMeshUpdated.invoke(this);
    }

    private _updatePosition() {
        const [pos, rotation] = this.calculateProgressAnchorPosition();
        this.container.position.copy(pos);
        this.container.rotation.copy(rotation);
    }

    private _destroyMeshes(): void {
        if (this.mesh) {
            this.container.remove(this.mesh);
            disposeMesh(this.mesh);
        }
        if (this.meshBackground) {
            this.container.remove(this.meshBackground);
            disposeMesh(this.meshBackground);
        }

        this.mesh = null;
        this.meshBackground = null;
    }

    private _handleTargetMeshUpdated(meshDecorator: IMeshDecorator): void {
        this._rebuildBarMeshes();
        this._updateColor();
        this._updateFill();
    }

    private calculateProgressAnchorPosition(): [Vector3, Euler] {
        // // Position the mesh some distance above the given object's bounding box.
        let targetSize = new Vector3(1, 1, 1);
        let targetCenter = new Vector3(0, 0, 0.5);

        const positionMultiplier = 0.6;

        if (this._anchor === 'floating') {
            //let posOffset = this.container.position.clone().sub(bottomCenter);
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y,
                targetCenter.z + targetSize.z * positionMultiplier + 0.1
            );

            return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
        } else if (this._anchor === 'front') {
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y - targetSize.y * positionMultiplier,
                targetCenter.z
            );

            return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
        } else if (this._anchor === 'back') {
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y + targetSize.y * positionMultiplier,
                targetCenter.z
            );

            return [pos, new Euler(ThreeMath.degToRad(-90), 0, 0)];
        } else if (this._anchor === 'left') {
            let pos = new Vector3(
                targetCenter.x + targetSize.x * positionMultiplier,
                targetCenter.y,
                targetCenter.z
            );

            return [
                pos,
                new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(90), 0),
            ];
        } else if (this._anchor === 'right') {
            let pos = new Vector3(
                targetCenter.x - targetSize.x * positionMultiplier,
                targetCenter.y,
                targetCenter.z
            );

            return [
                pos,
                new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(-90), 0),
            ];
        } else {
            // default to top
            let pos = new Vector3(
                targetCenter.x,
                targetCenter.y,
                targetCenter.z + 0.1
            );

            return [pos, new Euler(0, 0, 0)];
        }
    }
}
