import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateBotValue,
    getBotShape,
    BotShape,
    getBotSubShape,
    BotSubShape,
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
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { getPolyKey } from '../PolyUtils';
import axios from 'axios';
import { getGLTFPool } from '../GLTFHelpers';

const gltfPool = getGLTFPool('main');

export class BotShapeDecorator extends AuxBot3DDecoratorBase
    implements IMeshDecorator {
    private _shape: BotShape = null;
    private _subShape: BotSubShape = null;
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

        this._rebuildShape('cube', null, null);
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
        if (this._needsUpdate(shape, subShape, address)) {
            this._rebuildShape(shape, subShape, address);
        }

        this._updateColor(calc);
        this._updateStroke(calc);
    }

    private _needsUpdate(shape: string, subShape: string, address: string) {
        return (
            this._shape !== shape ||
            this._subShape !== subShape ||
            (shape === 'mesh' && this._address !== address)
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
        address: string
    ) {
        this._shape = shape;
        this._subShape = subShape;
        this._address = address;
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
            } else if (this._subShape === 'poly' && this._address) {
                this._createPoly();
            } else {
                this._createCube();
            }
        }

        this.onMeshUpdated.invoke(this);
    }

    private async _createPoly() {
        this.stroke = null;
        this._canHaveStroke = false;

        const group = this.bot3D.dimensionGroup;
        if (!group) {
            return;
        }
        const simulation = group.simulation3D.simulation;
        if (!simulation) {
            return;
        }
        const apiKey = getPolyKey(simulation);
        if (!apiKey) {
            console.warn(
                '[BotShapeDecorator] Trying to use a poly form but no poly api key is specified.'
            );
            return;
        }
        const id = this._address;
        try {
            const resp = await axios.get(
                `https://poly.googleapis.com/v1/assets/${id}/?key=${apiKey}`
            );
            const asset = resp.data;
            const format = asset.formats.find(
                (format: any) => format.formatType === 'GLTF'
            );
            if (!!format) {
                const url = format.root.url;
                await this._loadGLTF(url, true);
            }
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load Poly ' + this._address,
                err
            );
        }
    }

    private _createGltf() {
        this.stroke = null;
        this._canHaveStroke = false;
        this._loadGLTF(this._address, false);
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
        let box = new Box3();
        box.setFromObject(gltf.scene);
        let size = new Vector3();
        box.getSize(size);
        const maxScale = Math.max(size.x, size.y, size.z);
        gltf.scene.scale.divideScalar(maxScale);
        this.scene = gltf.scene;
        const collider = (this.collider = createCube(0.8));
        this.collider.position.set(0, 0.25, 0);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(gltf.scene);
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
