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
    hasValue,
    isBotPointable,
    LocalActions,
    BotScaleMode,
    getBotScaleMode,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import {
    Mesh,
    Group,
    Vector3,
    Box3,
    Object3D,
    AnimationMixer,
    AnimationAction,
    MathUtils as ThreeMath,
    LoopRepeat,
    LoopOnce,
    Color,
} from '@casual-simulation/three';
import {
    createCube,
    isTransparent,
    disposeMesh,
    createSphere,
    createSprite,
    disposeGroup,
    disposeObject3D,
    setColor,
    buildSRGBColor,
    calculateScale,
    baseAuxMeshMaterial,
    createCircle,
    DEFAULT_COLOR,
} from '../SceneUtils';
import { createCubeStroke } from '../MeshUtils';
import { LineSegments } from '../LineSegments';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { GLTF } from '@casual-simulation/three/examples/jsm/loaders/GLTFLoader';
import { getGLTFPool } from '../GLTFHelpers';
import { HtmlMixer, HtmlMixerHelpers } from '../HtmlMixer';
import { Game } from '../Game';
import { GameObject } from '../GameObject';
import { FrustumHelper } from '../helpers/FrustumHelper';
import HelixUrl from '../../public/meshes/dna_form.glb';
import EggUrl from '../../public/meshes/egg.glb';
import { Axial, HexMesh } from '../hex';
import { sortBy } from 'lodash';
import { SubscriptionLike } from 'rxjs';
// import { MeshLineMaterial } from 'three.meshline';
import { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';
import { Arrow3D } from '../Arrow3D';

import FontJSON from 'three-mesh-ui/examples/assets/Roboto-msdf.json';
import FontImage from 'three-mesh-ui/examples/assets/Roboto-msdf.png';
import Backspace from 'three-mesh-ui/examples/assets/backspace.png';
import Enter from 'three-mesh-ui/examples/assets/enter.png';
import Shift from 'three-mesh-ui/examples/assets/shift.png';
import { Keyboard, Block } from 'three-mesh-ui';

const gltfPool = getGLTFPool('main');

const KEYBOARD_COLORS = {
    keyboardBack: 0x858585,
    panelBack: 0x262626,
    button: 0x363636,
    hovered: 0x1c1c1c,
    selected: 0x109c5d,
};

export class BotShapeDecorator
    extends AuxBot3DDecoratorBase
    implements IMeshDecorator
{
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
    private _animationAddress: string;
    private _addressAspectRatio: number = 1;
    private _keyboard: Keyboard = null;

    /**
     * The 3d plane object used to display an iframe.
     */
    private _iframe: HtmlMixer.Plane;

    private _game: Game;
    private _shapeSubscription: SubscriptionLike;

    container: Group;
    mesh: Mesh | FrustumHelper;

    collider: Object3D;
    scene: Group;

    get allowModifications() {
        return this._subShape === null && this._shape !== 'iframe';
    }

    get allowMaterialModifications() {
        return (
            this._subShape === null &&
            this._shape !== 'iframe' &&
            this._shape !== 'frustum'
        );
    }

    /**
     * The optional stroke outline for the bot.
     */
    stroke: LineSegments;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
    }

    frameUpdate() {
        if (this._game && this._animationMixer) {
            this._animationMixer.update(this._game.getTime().deltaTime);
            this.scene?.updateMatrixWorld(true);
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
        const aspectRatio = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxFormAddressAspectRatio',
            1
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
        const animationAddress = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'auxFormAnimationAddress',
            null
        );
        if (
            this._needsUpdate(
                shape,
                subShape,
                scaleMode,
                address,
                aspectRatio,
                animationAddress,
                version
            )
        ) {
            this._rebuildShape(
                shape,
                subShape,
                scaleMode,
                address,
                aspectRatio,
                animationAddress,
                version
            );
        }

        this._updateColor(calc);
        this._updateStroke(calc);
        this._updateAddress(calc, address);
        this._updateAnimation(animation);
        this._updateAspectRatio(aspectRatio);

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
        aspectRatio: number,
        animationAddress: string,
        version: number
    ) {
        return (
            this._shape !== shape ||
            this._subShape !== subShape ||
            this._scaleMode !== scaleMode ||
            this._addressAspectRatio !== aspectRatio ||
            (shape === 'mesh' &&
                (this._address !== address ||
                    this._animationAddress !== animationAddress ||
                    this._gltfVersion !== version))
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
                this.stroke.dispose();
                this.container.remove(this.stroke);

                this.stroke = null;
            }
            return;
        }

        this.stroke.visible = true;
        const strokeMat = <LineMaterial>this.stroke.material;
        if (typeof strokeColorValue !== 'undefined') {
            strokeMat.visible = !isTransparent(strokeColorValue);
            if (strokeMat.visible) {
                this.stroke.setColor(buildSRGBColor(strokeColorValue));
            }
        } else {
            strokeMat.visible = false;
        }
        if (typeof strokeWidth !== 'undefined') {
            strokeMat.linewidth = Arrow3D.DefaultLineWidth * strokeWidth;
        } else {
            strokeMat.linewidth = Arrow3D.DefaultLineWidth;
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

    private _updateAspectRatio(aspectRatio: number) {
        this._addressAspectRatio = aspectRatio;
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
        this._animation = animation;
        if (!this._animationMixer) {
            return;
        }
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

        if (this._shapeSubscription) {
            this._shapeSubscription.unsubscribe();
            this._shapeSubscription = null;
        }

        this.bot3D.display.remove(this.container);
        disposeMesh(this.mesh);
        if (this.stroke) {
            this.stroke.dispose();
        }
        disposeObject3D(this.collider);
        if (this._iframe) {
            this.container.remove(this._iframe.object3d);
            disposeObject3D(this._iframe.object3d);
        }
        disposeGroup(this.scene);

        if (this._keyboard) {
            const index = this.bot3D.colliders.indexOf(this._keyboard);
            if (index >= 0) {
                this.bot3D.colliders.splice(index, 1);
            }
            this.container.remove(this._keyboard);
            this._keyboard = null;
        }

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

        if (this._keyboard) {
            let expectedColor = color
                ? new Color(color)
                : new Color(KEYBOARD_COLORS.keyboardBack);
            let firstPanel = (this._keyboard as any).panels[0];
            if (!expectedColor.equals(firstPanel.backgroundColor)) {
                for (let panel of (this._keyboard as any).panels) {
                    panel.set({
                        backgroundColor: expectedColor,
                    });
                }

                let selectedColor = color
                    ? new Color(color)
                    : new Color(KEYBOARD_COLORS.selected);

                for (let key of (this._keyboard as any).keys) {
                    key.setupState({
                        state: 'selected',
                        attributes: {
                            offset: -0.009,
                            backgroundColor: selectedColor,
                            backgroundOpacity: 1,
                        },
                    });
                }
            }
        }
    }

    private _rebuildShape(
        shape: BotShape,
        subShape: BotSubShape,
        scaleMode: BotScaleMode,
        address: string,
        addressAspectRatio: number,
        animationAddress: string,
        version: number
    ) {
        this._shape = shape;
        this._subShape = subShape;
        this._scaleMode = scaleMode;
        this._address = address;
        this._addressAspectRatio = addressAspectRatio;
        this._animationAddress = animationAddress;
        this._gltfVersion = version;
        if (
            this.mesh ||
            this.scene ||
            this._shapeSubscription ||
            this._keyboard
        ) {
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
        } else if (this._shape === 'frustum') {
            this._createFrustum();
        } else if (this._shape === 'helix') {
            this._createHelix();
        } else if (this._shape === 'egg') {
            this._createEgg();
        } else if (this._shape === 'hex') {
            this._createHex();
        } else if (this._shape === 'portal' || this._shape === 'dimension') {
            this._createPortal();
        } else if (this._shape === 'circle') {
            this._createCircle();
        } else if (this._shape === 'keyboard') {
            this._createKeyboard();
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
        const domElement =
            HtmlMixerHelpers.createIframeDomElement('about:blank');

        this._iframe = new HtmlMixer.Plane(mixerContext, domElement, {
            elementW: 768,
            planeW: 1,
            planeH: 1,
        });

        this.container.add(this._iframe.object3d);

        this._createCube();
        this.mesh.scale.set(1, 0.01, 0.05);
        this.mesh.position.set(0, -0.5, 0);
        this._canHaveStroke = false;

        return true;
    }

    private async _createGltf() {
        this.stroke = null;
        this._canHaveStroke = false;
        if (await this._loadGLTF(this._address, this._gltfVersion < 2)) {
            if (hasValue(this._animationAddress)) {
                this._loadAnimationGLTF(
                    this._animationAddress,
                    this._gltfVersion < 2
                );
            }
        }
    }

    private async _loadGLTF(url: string, legacy: boolean) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            if (!this.container) {
                // The decorator was disposed of by the Bot.
                return false;
            }
            this._setGltf(gltf);
            return true;
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load GLTF ' + url,
                err
            );

            return false;
        }
    }

    private async _loadAnimationGLTF(url: string, legacy: boolean) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            if (!this.container) {
                // The decorator was disposed of by the Bot.
                return;
            }
            this._processGLTFAnimations(gltf);
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load GLTF ' + url,
                err
            );
        }
    }

    private _setGltf(gltf: GLTF) {
        // Positioning
        gltf.scene.quaternion.setFromAxisAngle(
            new Vector3(1, 0, 0),
            Math.PI / 2
        );
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

        this.mesh = findFirstMesh(this.scene);

        // Collider
        const collider = (this.collider = createCube(1));
        this.collider.scale.copy(size);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);

        if (!hasValue(this._animationAddress)) {
            this._processGLTFAnimations(gltf);
        }

        const material: any = this.mesh.material;
        if (material && material.color) {
            material[DEFAULT_COLOR] = material.color;
        }

        this._updateColor(null);
        this.bot3D.updateMatrixWorld(true);
    }

    private _processGLTFAnimations(gltf: GLTF) {
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
            this._updateAnimation(this._animation, true);
        }
    }

    private _createSprite() {
        this.mesh = this.collider = createSprite(this._addressAspectRatio);
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

    private _createCircle() {
        this.mesh = this.collider = createCircle(0.5, this._addressAspectRatio);
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        // Stroke
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private _createKeyboard() {
        let keyboard = new Keyboard({
            language: 'eng',
            fontFamily: FontJSON,
            fontTexture: FontImage,
            fontSize: 0.035,
            backgroundColor: new Color(KEYBOARD_COLORS.keyboardBack),
            backgroundOpacity: 1,
            backspaceTexture: Backspace,
            shiftTexture: Shift,
            enterTexture: Enter,
        });

        for (let key of (keyboard as any).keys) {
            key.setupState({
                state: 'idle',
                attributes: {
                    offset: 0,
                    backgroundColor: new Color(KEYBOARD_COLORS.button),
                    backgroundOpacity: 1,
                },
            });

            key.setupState({
                state: 'hovered',
                attributes: {
                    offset: 0,
                    backgroundColor: new Color(KEYBOARD_COLORS.hovered),
                    backgroundOpacity: 1,
                },
            });

            key.setupState({
                state: 'selected',
                attributes: {
                    offset: -0.009,
                    backgroundColor: new Color(KEYBOARD_COLORS.selected),
                    backgroundOpacity: 1,
                },
            });

            key.setState('idle');

            key.keyboard = keyboard;
        }

        this.bot3D.colliders.push(keyboard);
        this._keyboard = keyboard;
        this.container.add(keyboard);
        this.stroke = null;
        this.mesh = null;
        this.collider = null;
        this._canHaveStroke = false;
        this._updateColor(null);
    }

    private _createCube() {
        this.mesh = this.collider = createCube(1, this._addressAspectRatio);
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        // Stroke
        this.stroke = null;
        this._canHaveStroke = true;
    }

    private _createFrustum() {
        this.mesh = new FrustumHelper();
        this.mesh.rotation.set(0, -Math.PI / 2, 0);
        this.container.add(this.mesh);
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private async _createHelix() {
        this.stroke = null;
        this.mesh = null;
        this._canHaveStroke = false;
        await this._loadGLTF(HelixUrl, false);
        this.mesh = this.scene.children[0] as Mesh;
        let material = baseAuxMeshMaterial();
        this.mesh.material = material;
        this._updateColor(null);
    }

    private async _createEgg() {
        this.stroke = null;
        this.mesh = null;
        this._canHaveStroke = false;
        await this._loadGLTF(EggUrl, false);
        this.mesh = this.scene.children[0] as Mesh;
        this._updateColor(null);
    }

    private async _createHex() {
        this.mesh = this.collider = new HexMesh(
            new Axial(0, 0),
            1,
            1,
            baseAuxMeshMaterial()
        );
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        // Stroke
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private _createPortal() {
        this.stroke = null;
        this.mesh = null;
        this._canHaveStroke = false;

        const sim = this.bot3D.dimensionGroup?.simulation3D;
        if (sim) {
            this._shapeSubscription = sim.registerDimensionForBot(
                this.bot3D,
                'formAddress'
            );
        }
    }
}

function createStroke() {
    const stroke = createCubeStroke();
    stroke.setColor(0x000000);
    return stroke;
}

function findFirstMesh(obj: Object3D): Mesh {
    const sorted = sortBy(obj.children, (c) => c.name);
    let mesh = sorted.find((c) => c instanceof Mesh) as Mesh;
    if (mesh) {
        return mesh;
    }
    for (let child of sorted) {
        mesh = findFirstMesh(child);
        if (mesh) {
            return mesh;
        }
    }

    return null;
}
