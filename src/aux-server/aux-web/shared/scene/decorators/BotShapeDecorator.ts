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
    getBotOrientationMode,
    getBotAnchorPoint,
    BotOrientationMode,
    BotAnchorPoint,
    calculateStringTagValue,
    hasValue,
    isBotPointable,
    LocalActions,
    getBotScale,
    BotScaleMode,
    getBotScaleMode,
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
    Vector2,
    Matrix4,
    Euler,
    AnimationMixer,
    SkinnedMesh,
    AnimationAction,
    MathUtils as ThreeMath,
    LoopRepeat,
    LoopOnce,
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
    buildSRGBColor,
    calculateScale,
} from '../SceneUtils';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { getGLTFPool } from '../GLTFHelpers';
import { HtmlMixer, HtmlMixerHelpers } from '../HtmlMixer';
import { Game } from '../Game';
import { GameObject } from '../GameObject';

const gltfPool = getGLTFPool('main');

export class BotShapeDecorator extends AuxBot3DDecoratorBase
    implements IMeshDecorator {
    private _shape: BotShape = null;
    private _subShape: BotSubShape = null;
    private _gltfVersion: number = null;
    private _address: string = null;
    private _animation: any = null;
    private _scaleMode: BotScaleMode = null;
    private _canHaveStroke = false;
    private _animationMixer: AnimationMixer;
    private _animClips: AnimationAction[];
    private _animClipMap: Map<string, AnimationAction>;

    /**
     * The 3d plane object used to display an iframe.
     */
    private _iframe: HtmlMixer.Plane;

    private _game: Game;

    container: Group;
    mesh: Mesh;

    collider: Object3D;
    scene: Scene;

    get allowModifications() {
        return this._subShape === null && this._shape !== 'iframe';
    }

    get allowMaterialModifications() {
        return this._subShape === null && this._shape !== 'iframe';
    }

    /**
     * The optional stroke outline for the bot.
     */
    stroke: LineSegments;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);

        this._game = game;
        this._rebuildShape('cube', null, null, null, null);
    }

    frameUpdate() {
        if (this._game && this._animationMixer) {
            this._animationMixer.update(this._game.getTime().deltaTime);
            this.scene.updateMatrixWorld(true);
        }
    }

    botUpdated(calc: BotCalculationContext): void {
        const shape = getBotShape(calc, this.bot3D.bot);
        const subShape = getBotSubShape(calc, this.bot3D.bot);
        const scaleMode = getBotScaleMode(calc, this.bot3D.bot);
        const address = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxFormAddress'
        );
        const version = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'gltfVersion',
            2
        );
        const animation = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxFormAnimation'
        );
        if (this._needsUpdate(shape, subShape, scaleMode, address, version)) {
            this._rebuildShape(shape, subShape, scaleMode, address, version);
        }

        this._updateColor(calc);
        this._updateStroke(calc);
        this._updateAddress(calc, address);
        this._updateAnimation(animation);

        if (this._iframe) {
            const gridScale = this.bot3D.gridScale;
            const scale = calculateScale(calc, this.bot3D.bot, gridScale);
            if (scale.x > scale.z) {
                const widthToHeightRatio = scale.z / scale.x;
                this._iframe.setPlaneSize(1, widthToHeightRatio);
            } else {
                const heightToWidthRatio = scale.x / scale.z;
                this._iframe.setPlaneSize(heightToWidthRatio, 1);
            }

            const pointable = isBotPointable(calc, this.bot3D.bot);
            this._iframe.setInteractable(pointable);
        }
    }

    localEvent(event: LocalActions, calc: BotCalculationContext) {
        if (event.type === 'local_form_animation') {
            this._playAnimation(event.animation);
        }
    }

    private _needsUpdate(
        shape: string,
        subShape: string,
        scaleMode: string,
        address: string,
        version: number
    ) {
        return (
            this._shape !== shape ||
            this._subShape !== subShape ||
            this._scaleMode !== scaleMode ||
            (shape === 'mesh' &&
                (this._address !== address || this._gltfVersion !== version))
        );
    }

    private _updateStroke(calc: BotCalculationContext) {
        if (!this._canHaveStroke || !this.mesh) {
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
                strokeMat.color = buildSRGBColor(strokeColorValue);
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

    private _updateAddress(calc: BotCalculationContext, address: string) {
        if (this._address === address) {
            return;
        }
        this._address = address;
        if (this._iframe) {
            if (this._subShape === 'src') {
                this._updateIframeSrc();
            } else if (this._subShape === 'html') {
                this._updateIframeHtml();
            } else {
                this._updateIframeHtml();
            }
        }
    }

    private _playAnimation(animation: string | number) {
        if (!this._animationMixer) {
            return;
        }

        console.log('[BotShapeDecorator] Play Animation:', animation);

        const clips = this._getClips(animation);

        if (clips.length > 0) {
            let previousTime = this._animationMixer.time;
            this._animationMixer.stopAllAction();
            this._animationMixer.setTime(0);

            let clips = this._getClips(animation);
            let startTimeOffset = 0;
            let lastClip: AnimationAction;

            if (clips.length === 1) {
                const clip = clips[0];
                clip.startAt(startTimeOffset);
                clip.play();
                clip.setLoop(LoopOnce, 1);
                lastClip = clip;
            } else if (clips.length > 0) {
                for (let i = 0; i < clips.length; i++) {
                    let clip = clips[i];
                    const isLast: boolean = i === clips.length - 1;
                    clip.startAt(startTimeOffset);
                    clip.play();
                    startTimeOffset += clip.getClip().duration;
                    if (isLast) {
                        lastClip = clip;
                    }
                    clip.setLoop(LoopOnce, 1);
                }
            }

            const listener = () => {
                console.log('[BotShapeDecorator] Finished Animation');
                this._updateAnimation(this._animation, true, previousTime);
                this._animationMixer.removeEventListener('finished', listener);
            };

            this._animationMixer.addEventListener('finished', listener);
        }
    }

    private _updateAnimation(
        animation: any,
        forceUpdate: boolean = false,
        startTime: number = 0
    ) {
        if (this._animation === animation && !forceUpdate) {
            return;
        }
        if (!this._animationMixer) {
            return;
        }
        this._animation = animation;
        this._animationMixer.stopAllAction();
        this._animationMixer.setTime(startTime);

        const noAnimation = animation === false;
        if (noAnimation) {
        } else if (hasValue(this._animation)) {
            let clips = this._getClips(this._animation);

            let startTimeOffset = 0;
            if (clips.length === 1) {
                const clip = clips[0];
                clip.startAt(startTimeOffset);
                clip.play();
            } else if (clips.length > 0) {
                for (let i = 0; i < clips.length; i++) {
                    let clip = clips[i];
                    const isLast: boolean = i === clips.length - 1;
                    clip.startAt(startTimeOffset);
                    clip.play();
                    startTimeOffset += clip.getClip().duration;
                    if (isLast) {
                        clip.setLoop(LoopRepeat, Infinity);
                    } else {
                        clip.setLoop(LoopOnce, 1);
                    }
                }
            }
        } else {
            this._animClips[0].play();
        }
    }

    private _getClips(animation: any): AnimationAction[] {
        if (Array.isArray(animation)) {
            let clips = [] as AnimationAction[];
            for (let i = 0; i < animation.length; i++) {
                const val = animation[i];
                let clip: AnimationAction;
                const isLast: boolean = i === animation.length - 1;
                if (typeof val === 'number') {
                    if (val >= 0 && val < this._animClips.length) {
                        clip = this._animClips[val];
                    }
                } else if (hasValue(val)) {
                    const name = val.toString();
                    clip = this._animClipMap.get(name);
                }

                if (clip) {
                    clips.push(clip);
                }
            }

            return clips;
        } else if (typeof animation === 'number') {
            const index = Math.floor(animation);
            if (index >= 0 && index < this._animClips.length) {
                const clip = this._animClips[index];
                if (clip) {
                    return [clip];
                }
            }
        } else if (hasValue(animation)) {
            const name = animation.toString();
            const clip = this._animClipMap.get(name);
            if (clip) {
                return [clip];
            }
        }

        return [];
    }

    private _updateIframeHtml() {
        HtmlMixerHelpers.setIframeHtml(this._iframe, this._address);
    }

    private _updateIframeSrc() {
        HtmlMixerHelpers.setIframeSrc(this._iframe, this._address);
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
        if (this._iframe) {
            this.container.remove(this._iframe.object3d);
            disposeObject3D(this._iframe.object3d);
        }
        disposeScene(this.scene);

        this._animationMixer = null;
        this.mesh = null;
        this.collider = null;
        this.container = null;
        this.scene = null;
        this.stroke = null;
        this._iframe = null;
    }

    private _updateColor(calc: BotCalculationContext) {
        const color = calculateBotValue(calc, this.bot3D.bot, 'auxColor');
        this._setColor(color);
    }

    private _setColor(color: any) {
        setColor(this.mesh, color);
    }

    private _rebuildShape(
        shape: BotShape,
        subShape: BotSubShape,
        scaleMode: BotScaleMode,
        address: string,
        version: number
    ) {
        this._shape = shape;
        this._subShape = subShape;
        this._scaleMode = scaleMode;
        this._address = address;
        this._gltfVersion = version;
        if (this.mesh || this.scene) {
            this.dispose();
        }

        // Container
        this.container = new Group();
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
        } else if (this._shape === 'iframe') {
            if (this._subShape === 'src') {
                this._createSrcIframe();
            } else if (this._subShape === 'html') {
                this._createHtmlIframe();
            } else {
                this._createHtmlIframe();
            }
        } else if (this._shape === 'nothing') {
            this.stroke = null;
            this._canHaveStroke = false;
        }

        this.onMeshUpdated.invoke(this);
    }

    private _createSrcIframe() {
        if (this._createIframe()) {
            this._updateIframeSrc();
        }
    }

    private _createHtmlIframe() {
        if (this._createIframe()) {
            this._updateIframeHtml();
        }
    }

    private _createIframe() {
        if (!this._game) {
            return false;
        }
        const mixerContext = this._game.getHtmlMixerContext();
        if (!mixerContext) {
            return false;
        }
        const domElement = HtmlMixerHelpers.createIframeDomElement(
            'about:blank'
        );

        this._iframe = new HtmlMixer.Plane(mixerContext, domElement, {
            elementW: 768,
            planeW: 1,
            planeH: 1,
        });

        this.container.add(this._iframe.object3d);
        this.container.rotation.set(ThreeMath.degToRad(-90), 0, 0);

        this._createCube();
        this.mesh.scale.set(1, 0.01, 0.05);
        this.mesh.position.set(0, -0.5, 0);
        this._canHaveStroke = false;

        return true;
    }

    private _createGltf() {
        this.stroke = null;
        this._canHaveStroke = false;
        this._loadGLTF(this._address, this._gltfVersion < 2);
    }

    private async _loadGLTF(url: string, legacy: boolean) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            if (!this.container) {
                // The decorator was disposed of by the Bot.
                return;
            }
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

        if (this._scaleMode !== 'absolute') {
            size.divideScalar(maxScale);
            center.divideScalar(maxScale);
            gltf.scene.scale.divideScalar(maxScale);
        }

        let bottomCenter = new Vector3(-center.x, -center.y, -center.z);

        // Scene
        gltf.scene.position.copy(bottomCenter);
        this.scene = gltf.scene;
        this.container.add(gltf.scene);

        // Collider
        const collider = (this.collider = createCube(1));
        this.collider.scale.copy(size);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);

        // Animations
        if (gltf.animations.length > 0) {
            this._animationMixer = new AnimationMixer(this.scene);
            let clipMap = new Map<string, AnimationAction>();
            let clips = [] as AnimationAction[];
            for (let anim of gltf.animations) {
                const action = this._animationMixer.clipAction(anim);
                clips.push(action);
                clipMap.set(anim.name, action);
            }

            this._animClips = clips;
            this._animClipMap = clipMap;
            this._updateAnimation(null, true);
        }

        this.bot3D.updateMatrixWorld(true);
    }

    private _createSprite() {
        this.mesh = this.collider = createSprite();
        this.mesh.rotation.set(ThreeMath.degToRad(-90), 0, 0);
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
