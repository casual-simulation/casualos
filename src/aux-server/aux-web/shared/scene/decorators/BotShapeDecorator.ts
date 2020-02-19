import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateBotValue,
    getBotShape,
    BotShape,
    getBotSubShape,
    BotSubShape,
    calculateNumericalTagValue,
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
    Box3,
    Scene,
    Object3D,
} from 'three';
import {
    createCube,
    createCubeStrokeGeometry,
    isTransparent,
    disposeMesh,
    createSphere,
    createSprite,
    disposeScene,
    disposeObject3D,
    setColor,
} from '../SceneUtils';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { getGLTFPool } from '../GLTFHelpers';

const gltfPool = getGLTFPool('main');

export class BotShapeDecorator extends AuxBot3DDecoratorBase
    implements IMeshDecorator {
    private _shape: BotShape = null;
    private _subShape: BotSubShape = null;
    private _gltfVersion: number = null;
    private _address: string = null;
    private _canHaveStroke = false;

    container: Group;
    mesh: Mesh | Sprite;
    collider: Object3D;
    scene: Scene;

    get allowModifications() {
        return this._subShape === null;
    }

    /**
     * The optional stroke outline for the bot.
     */
    stroke: LineSegments;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(bot3D: AuxBot3D) {
        super(bot3D);

        this._rebuildShape('cube', null, null, null);
    }

    // frameUpdate?(calc: BotCalculationContext): void {

    // }

    botUpdated(calc: BotCalculationContext): void {
        const shape = getBotShape(calc, this.bot3D.bot);
        const subShape = getBotSubShape(calc, this.bot3D.bot);
        const address = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxFormAddress'
        );
        const version = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxGLTFVersion',
            2
        );
        if (this._needsUpdate(shape, subShape, address, version)) {
            this._rebuildShape(shape, subShape, address, version);
        }

        this._updateColor(calc);
        this._updateStroke(calc);
    }

    private _needsUpdate(
        shape: string,
        subShape: string,
        address: string,
        version: number
    ) {
        return (
            this._shape !== shape ||
            this._subShape !== subShape ||
            (shape === 'mesh' &&
                (this._address !== address || this._gltfVersion !== version))
        );
    }

    private _updateStroke(calc: BotCalculationContext) {
        if (!this._canHaveStroke) {
            return;
        }

        const strokeColorValue = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxStrokeColor'
        );
        const strokeWidth: number = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxStrokeWidth'
        );

        const hasStroke = typeof strokeColorValue !== 'undefined';
        if (hasStroke && !this.stroke) {
            this.stroke = createStroke();
            this.container.add(this.stroke);
        } else if (!hasStroke) {
            if (this.stroke) {
                disposeMesh(this.stroke);
                this.container.remove(this.stroke);

                this.stroke = null;
            }
            return;
        }

        this.stroke.visible = true;
        const strokeMat = <LineBasicMaterial>this.stroke.material;
        if (typeof strokeColorValue !== 'undefined') {
            strokeMat.visible = !isTransparent(strokeColorValue);
            if (strokeMat.visible) {
                strokeMat.color = new Color(strokeColorValue);
            }
        } else {
            strokeMat.visible = false;
        }
        if (typeof strokeWidth !== 'undefined') {
            strokeMat.linewidth = strokeWidth;
        } else {
            strokeMat.linewidth = 1;
        }
    }

    dispose(): void {
        const index = this.bot3D.colliders.indexOf(this.collider);
        if (index >= 0) {
            this.bot3D.colliders.splice(index, 1);
        }

        this.bot3D.display.remove(this.container);
        disposeMesh(this.mesh);
        disposeMesh(this.stroke);
        disposeObject3D(this.collider);
        disposeScene(this.scene);

        this.mesh = null;
        this.collider = null;
        this.container = null;
        this.scene = null;
        this.stroke = null;
    }

    private _updateColor(calc: BotCalculationContext) {
        let color: any = null;
        if (this.bot3D.bot.tags['auxColor']) {
            color = calculateBotValue(calc, this.bot3D.bot, 'auxColor');
        }

        this._setColor(color);
    }

    private _setColor(color: any) {
        setColor(this.mesh, color);
    }

    private _rebuildShape(
        shape: BotShape,
        subShape: BotSubShape,
        address: string,
        version: number
    ) {
        this._shape = shape;
        this._subShape = subShape;
        this._address = address;
        this._gltfVersion = version;
        if (this.mesh || this.scene) {
            this.dispose();
        }

        // Container
        this.container = new Group();
        this.container.position.set(0, 0.5, 0);
        this.bot3D.display.add(this.container);

        if (this._shape === 'cube') {
            this._createCube();
        } else if (this._shape === 'sphere') {
            this._createSphere();
        } else if (this._shape === 'sprite') {
            this._createSprite();
        } else if (this._shape === 'mesh') {
            if (this._subShape === 'gltf' && this._address) {
                this._createGltf();
            } else {
                this._createCube();
            }
        }

        this.onMeshUpdated.invoke(this);
    }

    private _createGltf() {
        this.stroke = null;
        this._canHaveStroke = false;
        this._loadGLTF(this._address, this._gltfVersion < 2);
    }

    private async _loadGLTF(url: string, legacy: boolean) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            this._setGltf(gltf);
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load GLTF ' + url,
                err
            );
        }
    }

    private _setGltf(gltf: GLTF) {
        // Positioning
        let box = new Box3();
        box.setFromObject(gltf.scene);
        let size = new Vector3();
        box.getSize(size);
        let center = new Vector3();
        box.getCenter(center);
        const maxScale = Math.max(size.x, size.y, size.z);
        size.divideScalar(maxScale);
        center.divideScalar(maxScale);

        let bottomCenter = new Vector3(-center.x, -center.y, -center.z);

        // Scene
        gltf.scene.scale.divideScalar(maxScale);
        gltf.scene.position.copy(bottomCenter);
        this.scene = gltf.scene;
        this.container.add(gltf.scene);

        // Collider
        const collider = (this.collider = createCube(1));
        this.collider.scale.copy(size);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);

        this.bot3D.updateMatrixWorld(true);
    }

    private _createSprite() {
        this.mesh = this.collider = createSprite();
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private _createSphere() {
        this.mesh = this.collider = createSphere(
            new Vector3(0, 0, 0),
            0x000000,
            0.5
        );
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private _createCube() {
        this.mesh = this.collider = createCube(1);
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        // Stroke
        this.stroke = null;
        this._canHaveStroke = true;
    }
}

function createStroke() {
    const geo = createCubeStrokeGeometry();
    const material = new LineBasicMaterial({
        color: 0x000000,
    });

    return new LineSegments(geo, material);
}
