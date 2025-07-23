/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    BotCalculationContext,
    BotMeshPositioningMode,
    BotScaleMode,
    BotShape,
    BotSubShape,
    LocalActions,
    StartFormAnimationAction,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    calculateBooleanTagValue,
    calculateBotIds,
    calculateBotValue,
    calculateNumericalTagValue,
    calculateStringTagValue,
    getBotMeshPositioningMode,
    getBotScaleMode,
    getBotShape,
    getBotSubShape,
    hasValue,
    isBotPointable,
    parseBotVector,
} from '@casual-simulation/aux-common';
import { ArgEvent } from '@casual-simulation/aux-common/Event';
import type { AnimationAction } from '@casual-simulation/three';
import {
    AnimationMixer,
    Box3,
    Color,
    DirectionalLight,
    Group,
    HemisphereLight,
    LoopOnce,
    LoopRepeat,
    Mesh,
    Object3D,
    PointLight,
    SpotLight,
    Vector3,
    AmbientLight,
    Light,
    ObjectLoader,
    Vector2,
} from '@casual-simulation/three';
import type { GLTF } from '@casual-simulation/three/examples/jsm/loaders/GLTFLoader';
import { sortBy } from 'lodash';
import type { SubscriptionLike } from 'rxjs';
import HelixUrl from '../../public/meshes/dna_form.glb';
import EggUrl from '../../public/meshes/egg.glb';
import { AuxBot3D } from '../AuxBot3D';
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { getGLTFPool } from '../GLTFHelpers';
import type { Game } from '../Game';
import { HtmlMixer, HtmlMixerHelpers } from '../HtmlMixer';
import type { LineSegments } from '../LineSegments';
import { createCubeStroke } from '../MeshUtils';
import {
    DEFAULT_COLOR,
    DEFAULT_OPACITY,
    DEFAULT_TRANSPARENT,
    baseAuxMeshMaterial,
    buildSRGBColor,
    calculateScale,
    createCircle,
    createCube,
    createSkybox,
    createSphere,
    createSprite,
    disposeMesh,
    disposeObject3D,
    isTransparent,
    registerMaterial,
    setColor,
    setDepthTest,
    setDepthWrite,
    setLightIntensity,
    setOpacity,
    setLightDistance,
    setLightAngle,
    setLightPenumbra,
    setLightDecay,
    setLightGroundColor,
    createMapPlane,
    createPlane,
    defaultMapProvider,
    getMapProvider,
} from '../SceneUtils';
import { FrustumHelper } from '../helpers/FrustumHelper';
import { Axial, HexMesh } from '../hex';
import type { IMeshDecorator } from './IMeshDecorator';
// import { MeshLineMaterial } from 'three.meshline';
import type { LineMaterial } from '@casual-simulation/three/examples/jsm/lines/LineMaterial';
import { Arrow3D } from '../Arrow3D';

import { Keyboard, update as updateMeshUI } from 'three-mesh-ui';
import FontJSON from 'three-mesh-ui/examples/assets/Roboto-msdf.json';
import FontImage from 'three-mesh-ui/examples/assets/Roboto-msdf.png';
import Backspace from 'three-mesh-ui/examples/assets/backspace.png';
import Enter from 'three-mesh-ui/examples/assets/enter.png';
import Shift from 'three-mesh-ui/examples/assets/shift.png';
import type { AnimationMixerHandle } from '../AnimationHelper';
import type { AuxBotVisualizerFinder } from '../../AuxBotVisualizerFinder';
import { LDrawLoader } from '../../public/ldraw-loader/LDrawLoader';
import { MapView } from '../map/MapView';
import { MapTilerProvider } from 'geo-three';
import { CustomMapProvider } from '../map/CustomMapProvider';
// import { LODConstant } from '../../public/geo-three/LODConstant';

export const gltfPool = getGLTFPool('main');

const DEFAULT_LIGHT_TARGET = new Object3D();
const KEYBOARD_COLORS = {
    keyboardBack: 0x858585,
    panelBack: 0x262626,
    button: 0x363636,
    hovered: 0x1c1c1c,
    selected: 0x109c5d,
};

interface CancellationToken {
    isCanceled: boolean;
}

let ldrawLoader: LDrawLoader = null;
let jsonObjectLoader: ObjectLoader = null;

export class BotShapeDecorator
    extends AuxBot3DDecoratorBase
    implements IMeshDecorator
{
    private _shape: BotShape = null;
    private _subShape: BotSubShape = null;
    private _gltfVersion: number = null;
    private _address: string = null;
    private _ldrawPartsAddress: string = null;
    private _animation: any = null;
    private _scaleMode: BotScaleMode = null;
    private _positioningMode: BotMeshPositioningMode;
    private _canHaveStroke = false;
    // private _animationMode: 'tag' | 'action' = 'tag';
    private _animationMixer: AnimationMixer;
    private _animationEnabled: boolean = true;
    private _animClips: AnimationAction[];
    private _animClipMap: Map<string, AnimationAction>;
    private _animationAddress: string;
    private _addressAspectRatio: number = 1;
    private _keyboard: Keyboard = null;
    private _animationHandle: AnimationMixerHandle = null;
    private _meshCancellationToken: CancellationToken;
    private _mapLODLevel: number = 1;
    // private _lodConstant: LODConstant | null = null;

    /**
     * The 3d plane object used to display an iframe.
     */
    private _iframe: HtmlMixer.Plane;

    private _game: Game;
    private _shapeSubscription: SubscriptionLike;
    private _finder: AuxBotVisualizerFinder;
    private _mapView: MapView;
    private _mapProviderName: string;
    private _mapProviderApiKey: string;

    container: Group;
    mesh: Mesh | FrustumHelper;
    light: Light;

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

    constructor(bot3D: AuxBot3D, game: Game, finder: AuxBotVisualizerFinder) {
        super(bot3D);
        this._game = game;
        this._finder = finder;
    }

    private _asyncResult(...args: Parameters<typeof asyncResult>) {
        return this.bot3D.dimensionGroup.simulation3D.simulation.helper.transaction(
            asyncResult(...args)
        );
    }

    frameUpdate() {
        if (this._game && this._animationMixer && this._animationEnabled) {
            this._animationMixer.update(this._game.getTime().deltaTime);
            this.scene?.updateMatrixWorld(true);
        }
        this._updateLightTarget(null);
    }

    botUpdated(calc: BotCalculationContext): void {
        const shape = getBotShape(calc, this.bot3D.bot);
        const subShape = getBotSubShape(calc, this.bot3D.bot);
        const scaleMode = getBotScaleMode(calc, this.bot3D.bot);
        const positioningMode = getBotMeshPositioningMode(calc, this.bot3D.bot);
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
        const ldrawPartsAddress = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'auxFormLDrawPartsAddress',
            null
        );
        if (
            this._needsUpdate(
                shape,
                subShape,
                scaleMode,
                positioningMode,
                address,
                aspectRatio,
                animationAddress,
                version,
                ldrawPartsAddress
            )
        ) {
            this._rebuildShape(
                shape,
                subShape,
                scaleMode,
                positioningMode,
                address,
                aspectRatio,
                animationAddress,
                version,
                ldrawPartsAddress
            );
        }

        this._updateColor(calc);
        this._updateOpacity(calc);
        this._updateStroke(calc);
        this._updateAddress(calc, address);
        this._updateRenderOrder(calc);
        this._updateAnimation(animation);
        this._updateAspectRatio(aspectRatio);
        this._updateDepth(calc);
        this._updateDepthWrite(calc);
        this._updateLightIntensity(calc);
        this._updateLightTarget(calc);
        this._updateLightDistance(calc);
        this._updateLightAngle(calc);
        this._updateLightPenumbra(calc);
        this._updateLightDecay(calc);
        this._updateLightGroundColor(calc);
        this._updateBuildStep(calc);

        // For map forms, update map-specific properties
        if (this._shape === 'map' && this._mapView) {
            this._updateMapLOD(calc);
            this._updateMapTags(calc);
            this._updateMapProvider(calc);
            this._updateCustomMapProviderURL(calc);
        }

        if (this._iframe) {
            const gridScale = this.bot3D.gridScale;
            const scale = calculateScale(calc, this.bot3D.bot, gridScale);
            if (scale.x > scale.y) {
                const widthToHeightRatio = scale.y / scale.x;
                this._iframe.setPlaneSize(1, widthToHeightRatio);
            } else {
                const heightToWidthRatio = scale.x / scale.y;
                this._iframe.setPlaneSize(heightToWidthRatio, 1);
            }

            const pointable = isBotPointable(calc, this.bot3D.bot);
            this._iframe.setInteractable(pointable);
        }
    }

    localEvent(event: LocalActions, calc: BotCalculationContext) {
        if (event.type === 'local_form_animation') {
            this._playLocalAnimation(event.animation);
        }
        if (
            event.type === 'add_bot_map_overlay' ||
            event.type === 'remove_bot_map_overlay'
        ) {
            this._asyncResult(
                event.taskId,
                this._mapView
                    ? this._mapView.localEvent(event, calc)
                    : {
                          success: false,
                          message: 'Map view not available for bot.',
                      }
            );
        }
    }

    async startAnimation(event: StartFormAnimationAction): Promise<void> {
        const gltf = await gltfPool.loadGLTF(
            event.animationAddress ?? this._address
        );

        const anim = gltf.animations.find((a) => a.name === event.nameOrIndex);
    }

    private _needsUpdate(
        shape: string,
        subShape: string,
        scaleMode: string,
        positioningMode: string,
        address: string,
        aspectRatio: number,
        animationAddress: string,
        version: number,
        ldrawPartsAddress: string
    ) {
        return (
            this._shape !== shape ||
            this._subShape !== subShape ||
            this._scaleMode !== scaleMode ||
            this._positioningMode !== positioningMode ||
            this._addressAspectRatio !== aspectRatio ||
            (shape === 'mesh' &&
                (this._address !== address ||
                    this._animationAddress !== animationAddress ||
                    this._gltfVersion !== version ||
                    this._ldrawPartsAddress !== ldrawPartsAddress))
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

        if (this._mapView) {
            address = String(address); // The address could be coerced to a number, ensure it's a string.
            // Check if the address is a URL
            if (
                address &&
                (address.startsWith('http://') ||
                    address.startsWith('https://'))
            ) {
                // This appears to be a URL - create or update a custom map provider
                this._updateCustomMapProviderForURL(address);
            } else {
                // Treat as coordinates
                const coords = parseBotVector(address) ?? new Vector2(0, 0);
                this._mapView.setCenter(
                    this._mapLODLevel,
                    coords.x, // lon
                    coords.y // lat
                );
            }
        }
    }

    private _updateCustomMapProviderForURL(url: string) {
        // Parse the URL
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname
                .split('/')
                .filter((p) => p.length > 0);

            // Identify URL pattern
            if (pathParts.length >= 3) {
                // Possible patterns: domain/zoom/x/y.png or domain/tiles/zoom/x/y.png
                let zoom, x, y;

                const tilesDirIndex = pathParts.findIndex((p) => p === 'tiles');

                if (
                    tilesDirIndex >= 0 &&
                    pathParts.length >= tilesDirIndex + 4
                ) {
                    zoom = parseInt(pathParts[tilesDirIndex + 1]);
                    x = parseInt(pathParts[tilesDirIndex + 2]);
                    y = parseInt(pathParts[tilesDirIndex + 3].split('.')[0]);
                } else {
                    zoom = parseInt(pathParts[pathParts.length - 3]);
                    x = parseInt(pathParts[pathParts.length - 2]);
                    y = parseInt(pathParts[pathParts.length - 1].split('.')[0]);
                }

                if (!isNaN(zoom) && !isNaN(x) && !isNaN(y)) {
                    // Create URL template
                    let template = CustomMapProvider.createTemplateFromUrl(
                        url,
                        zoom,
                        x,
                        y
                    );

                    // Set or update a custom provider
                    const customProvider = new CustomMapProvider(template);
                    this._mapView.setProvider(customProvider);

                    // Convert tile coordinates to longitude/latitude
                    const [lon, lat] = MapView.tileToLonLat(zoom, x, y);

                    // Center the map on these coordinates
                    this._mapView.setZoom(zoom);
                    this._mapView.setCenter(zoom, lon, lat);
                    return;
                }
            }

            // If the URL pattern couldn't be parsed, use it directly as a single tile
            const customProvider = new CustomMapProvider(url);
            customProvider.setUrlTemplate(url);
            this._mapView.setProvider(customProvider);
        } catch (error) {
            console.error('Failed to parse map tile URL:', error);
        }
    }

    private _updateAspectRatio(aspectRatio: number) {
        this._addressAspectRatio = aspectRatio;
    }

    private _playLocalAnimation(animation: string | number) {
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
            /* empty */
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
        this.light = null;

        disposeMesh(this.mesh, true, true, true);
        if (this.stroke) {
            this.stroke.dispose();
        }
        if (this.collider) {
            this.container.remove(this.collider);
        }
        disposeObject3D(this.collider);
        if (this._iframe) {
            this.container.remove(this._iframe.object3d);
            disposeObject3D(this._iframe.object3d);
        }

        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    disposeMesh(obj, true, true, true);
                } else {
                    disposeObject3D(obj);
                }
            });
        }

        if (this._keyboard) {
            for (let key of (this._keyboard as any).keys) {
                const index = this.bot3D.colliders.indexOf(key);
                if (index >= 0) {
                    this.bot3D.colliders.splice(index, 1);
                }
            }
            for (let panel of (this._keyboard as any).panels) {
                const index = this.bot3D.colliders.indexOf(panel);
                if (index >= 0) {
                    this.bot3D.colliders.splice(index, 1);
                }
            }
            this.container.remove(this._keyboard);
            this._keyboard = null;
        }

        if (this._animationHandle) {
            this._animationHandle.unsubscribe();
            this._animationHandle = null;
            this._animationEnabled = true;
        }

        if (this._meshCancellationToken) {
            this._meshCancellationToken.isCanceled = true;
        }

        if (this._mapView) {
            this._mapView.dispose();
            this.container.remove(this._mapView);
            this._mapView = null;
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
    private _updateDepth(calc: BotCalculationContext) {
        const depthTest = calculateBooleanTagValue(
            calc,
            this.bot3D.bot,
            'formDepthTest',
            true
        );
        this._setDepthTest(depthTest);
    }

    private _updateDepthWrite(calc: BotCalculationContext) {
        const depthWrite = calculateBooleanTagValue(
            calc,
            this.bot3D.bot,
            'formDepthWrite',
            true
        );
        this._setDepthWrite(depthWrite);
    }

    private _updateLightIntensity(calc: BotCalculationContext) {
        const lightIntensity = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formLightIntensity',
            1
        );
        this._setLightIntensity(lightIntensity);
    }

    private _updateLightDistance(calc: BotCalculationContext) {
        const lightDistance = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formLightDistance',
            0
        );
        this._setLightDistance(lightDistance);
    }

    private _updateLightAngle(calc: BotCalculationContext) {
        const lightAngle = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formLightAngle',
            Math.PI * 0.3333333333333
        );
        this._setLightAngle(lightAngle);
    }

    private _updateLightPenumbra(calc: BotCalculationContext) {
        const lightPenumbra = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formLightPenumbra',
            0
        );
        this._setLightPenumbra(lightPenumbra);
    }

    private _updateLightDecay(calc: BotCalculationContext) {
        const lightDecay = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formLightDecay',
            2
        );
        this._setLightDecay(lightDecay);
    }

    private _updateLightGroundColor(calc: BotCalculationContext) {
        const groundColor = calculateBotValue(
            calc,
            this.bot3D.bot,
            'formLightGroundColor'
        );
        this._setLightGroundColor(groundColor);
    }

    private _updateMapLOD(calc: BotCalculationContext) {
        if (!this._mapView) {
            return;
        }

        const lodLevel = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formMapLOD',
            1
        );

        const lodLimit = Math.max(1, Math.min(20, Math.floor(lodLevel)));

        if (this._mapLODLevel !== lodLimit) {
            if (lodLevel !== lodLimit) {
                console.warn(
                    `Map LOD level ${lodLevel} was clamped to ${lodLimit} (valid range: 1-20)`
                );
            }
            this._mapLODLevel = lodLimit;
            this._setMapLOD(this._mapLODLevel);
        }
    }

    private _updateMapTags(calc: BotCalculationContext) {
        if (!this._mapView) {
            return;
        }

        const heightProvider = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'formMapHeightProvider',
            null
        );

        if (heightProvider === 'maptiler') {
            const mapTilerApiKey = calculateStringTagValue(
                calc,
                this.bot3D.bot,
                'formMapHeightProviderAPIKey',
                null
            );
            if (
                !(this._mapView.heightProvider instanceof MapTilerProvider) ||
                this._mapView.heightProvider.apiKey !== mapTilerApiKey
            ) {
                this._mapView.setHeightProvider(
                    new MapTilerProvider(
                        mapTilerApiKey,
                        'tiles',
                        'terrain-rgb-v2',
                        'webp'
                    )
                );
            }
        } else {
            this._mapView.setHeightProvider(null);
        }

        const heightOffset = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formMapHeightOffset',
            0
        );

        this._mapView.setHeightOffset(heightOffset);
    }

    private _updateOpacity(calc: BotCalculationContext) {
        const opacity = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'formOpacity',
            1
        );
        this._setOpacity(opacity);
    }

    private _setColor(color: any) {
        if (this.scene) {
            // Color all meshes inside the gltf scene.
            this.scene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    setColor(obj, color);
                }
            });
        } else {
            setColor(this.mesh, color);
            setColor(this.light, color);
        }

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
    private _setDepthTest(depthTest: boolean) {
        if (this.scene) {
            // Change depth
            this.scene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    setDepthTest(obj, depthTest);
                }
            });
        } else {
            setDepthTest(this.mesh, depthTest);
        }
    }
    private _setDepthWrite(depthWrite: boolean) {
        if (this.scene) {
            // Change
            this.scene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    setDepthWrite(obj, depthWrite);
                }
            });
        } else {
            setDepthWrite(this.mesh, depthWrite);
        }
    }

    private _setLightIntensity(lightIntensity: number) {
        if (this.scene) {
            // Change
            this.scene.traverse((obj) => {
                if (obj instanceof Light) {
                    setLightIntensity(obj, lightIntensity);
                }
            });
        } else {
            setLightIntensity(this.light, lightIntensity);
        }
    }

    private _setLightDistance(lightDistance: number) {
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof SpotLight) {
                    setLightDistance(obj, lightDistance);
                }
            });
        } else if (this.light instanceof SpotLight) {
            setLightDistance(this.light, lightDistance);
        }
    }

    private _setLightAngle(lightAngle: number) {
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof SpotLight) {
                    setLightAngle(obj, lightAngle);
                }
            });
        } else if (this.light instanceof SpotLight) {
            setLightAngle(this.light, lightAngle);
        }
    }

    private _setLightPenumbra(lightPenumbra: number) {
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof SpotLight) {
                    setLightPenumbra(obj, lightPenumbra);
                }
            });
        } else if (this.light instanceof SpotLight) {
            setLightPenumbra(this.light, lightPenumbra);
        }
    }

    private _setLightDecay(lightDecay: number) {
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof SpotLight) {
                    setLightDecay(obj, lightDecay);
                }
            });
        } else if (this.light instanceof SpotLight) {
            setLightDecay(this.light, lightDecay);
        }
    }

    private _setLightGroundColor(lightColor: any) {
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj instanceof HemisphereLight) {
                    setLightGroundColor(obj, lightColor);
                }
            });
        } else if (this.light instanceof HemisphereLight) {
            setLightGroundColor(this.light, lightColor);
        }
    }

    private _setOpacity(opacity: number) {
        if (this.scene) {
            // Set opacity on all meshes inside the gltf scene.
            this.scene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    setOpacity(obj, opacity);
                }
            });
        } else {
            setOpacity(this.mesh, opacity);
        }

        if (this._keyboard) {
            const defaultOpacity = 1;
            const newOpacity = defaultOpacity * opacity;

            for (let panel of (this._keyboard as any).panels) {
                panel.set({
                    backgroundOpacity: newOpacity,
                });
            }

            for (let key of (this._keyboard as any).keys) {
                // Update each key state with new backgroundOpacity.
                const states = key.states;
                for (let stateId in states) {
                    const attributes = states[stateId].attributes;
                    attributes.backgroundOpacity = newOpacity;

                    key.setupState({ stateId, attributes });
                }

                // Set the current backgroundOpacity for the key.
                key.set({ backgroundOpacity: newOpacity });
            }
        }
    }

    private _setMapLOD(level: number): void {
        if (!this._mapView) {
            return;
        }

        this._mapView.setZoom(level);
    }

    private _updateRenderOrder(calc: BotCalculationContext) {
        const renderOrder = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxFormRenderOrder',
            0
        );
        if (this.mesh) {
            this.mesh.renderOrder = renderOrder;
        }
        if (this.stroke) {
            this.stroke.renderOrder = renderOrder;
        }
    }

    private _updateBuildStep(calc: BotCalculationContext) {
        if (this._subShape === 'ldraw' || this._subShape === 'ldrawText') {
            const buildStep = calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxFormBuildStep',
                Infinity
            );
            if (this.scene) {
                this.scene.traverse((obj) => {
                    if (obj instanceof Group) {
                        const step = obj.userData.buildingStep ?? 0;
                        obj.visible = step <= buildStep;
                    }
                });
            }
        }
    }

    private _rebuildShape(
        shape: BotShape,
        subShape: BotSubShape,
        scaleMode: BotScaleMode,
        positioningMode: BotMeshPositioningMode,
        address: string,
        addressAspectRatio: number,
        animationAddress: string,
        version: number,
        ldrawPartsAddress: string
    ) {
        this._shape = shape;
        this._subShape = subShape;
        this._scaleMode = scaleMode;
        this._positioningMode = positioningMode;
        this._address = address;
        this._addressAspectRatio = addressAspectRatio;
        this._animationAddress = animationAddress;
        this._gltfVersion = version;
        this._ldrawPartsAddress = ldrawPartsAddress;
        if (
            this.mesh ||
            this.scene ||
            this._shapeSubscription ||
            this._keyboard ||
            this.light
        ) {
            this.dispose();
        }
        if (this._meshCancellationToken) {
            this._meshCancellationToken.isCanceled = true;
        }

        // Container
        this.container = new Group();
        this.bot3D.display.add(this.container);

        if (this._shape === 'cube') {
            this._createCube();
        } else if (this._shape === 'skybox') {
            this._createSkybox();
        } else if (this._shape === 'sphere') {
            this._createSphere();
        } else if (this._shape === 'sprite') {
            this._createSprite();
        } else if (this._shape === 'map') {
            this._createMapPlane();
        } else if (this._shape === 'mesh') {
            if (this._subShape === 'gltf' && this._address) {
                this._createGltf();
            } else if (
                this._address &&
                (this._subShape === 'ldraw' || this._subShape === 'ldrawText')
            ) {
                this._createLDraw();
            } else if (this._subShape === 'jsonObject' && this._address) {
                this._createJsonObject();
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
        } else if (
            this._shape === 'portal' ||
            this._shape === 'dimension' ||
            this._shape === 'spherePortal'
        ) {
            this._createPortal();
        } else if (this._shape === 'circle') {
            this._createCircle();
        } else if (this._shape === 'keyboard') {
            this._createKeyboard();
        } else if (this._shape === 'light') {
            if (this._subShape === 'pointLight') {
                this._createPointLight();
            } else if (this._subShape === 'ambientLight') {
                this._createAmbientLight();
            } else if (this._subShape === 'directionalLight') {
                this._createDirectionalLight();
            } else if (this._subShape === 'spotLight') {
                this._createSpotLight();
            } else if (this._subShape === 'hemisphereLight') {
                this._createHemisphereLight();
            } else {
                this._createPointLight();
            }
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
        let token: CancellationToken = {
            isCanceled: false,
        };
        this._meshCancellationToken = token;
        if (await this._loadGLTF(this._address, this._gltfVersion < 2, token)) {
            if (hasValue(this._animationAddress)) {
                this._loadAnimationGLTF(
                    this._animationAddress,
                    this._gltfVersion < 2,
                    token
                );
            }
        }
    }

    private async _loadGLTF(
        url: string,
        legacy: boolean,
        cancellationToken: CancellationToken
    ) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            if (!this.container || cancellationToken.isCanceled) {
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

    private async _loadAnimationGLTF(
        url: string,
        legacy: boolean,
        cancellationToken: CancellationToken
    ) {
        try {
            const gltf = await gltfPool.loadGLTF(url, legacy);
            if (!this.container || cancellationToken.isCanceled) {
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

        if (this._positioningMode !== 'absolute') {
            let bottomCenter = new Vector3(-center.x, -center.y, -center.z);
            // Scene
            gltf.scene.position.copy(bottomCenter);
        }

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

        const sim = this.bot3D.dimensionGroup?.simulation3D;
        if (sim) {
            this._animationHandle = sim.animation.getAnimationMixerHandle(
                this.bot3D.bot.id,
                {
                    object: this.scene,
                    startLocalMixer: () => {
                        this._animationEnabled = true;
                    },
                    stopLocalMixer: () => {
                        this._animationEnabled = false;
                    },
                }
            );
        }

        this.scene.traverse((obj) => {
            if (obj instanceof Mesh) {
                const material = obj.material;
                if (material) {
                    registerMaterial(material);

                    if (material.color) {
                        material[DEFAULT_COLOR] = material.color;
                    }

                    if (
                        typeof material.opacity === 'number' &&
                        !Number.isNaN(material.opacity)
                    ) {
                        material[DEFAULT_OPACITY] = material.opacity;
                    }

                    if (typeof material.transparent === 'boolean') {
                        material[DEFAULT_TRANSPARENT] = material.transparent;
                    }
                }
            }
        });

        this._updateColor(null);
        this._updateOpacity(null);
        this._updateRenderOrder(null);
        this.bot3D.updateMatrixWorld(true);
    }

    private async _createLDraw() {
        this.stroke = null;
        this._canHaveStroke = false;
        let token: CancellationToken = {
            isCanceled: false,
        };
        this._meshCancellationToken = token;

        if (this._subShape === 'ldraw') {
            await this._loadLDraw(this._address, token);
        } else {
            await this._parseLDraw(this._address, token);
        }
    }

    private async _loadLDraw(
        url: string,
        cancellationToken: CancellationToken
    ) {
        try {
            if (!ldrawLoader) {
                ldrawLoader = new LDrawLoader();
            }
            (ldrawLoader as any).setPartsLibraryPath(this._ldrawPartsAddress);
            const ldraw = await ldrawLoader.loadAsync(url);
            if (!this.container || cancellationToken.isCanceled) {
                // The decorator was disposed of by the Bot.
                return false;
            }
            this._setLDraw(ldraw);
            return true;
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load LDraw:',
                url,
                err
            );

            return false;
        }
    }

    private async _parseLDraw(
        text: string,
        cancellationToken: CancellationToken
    ) {
        try {
            if (!ldrawLoader) {
                ldrawLoader = new LDrawLoader();
            }
            (ldrawLoader as any).setPartsLibraryPath(this._ldrawPartsAddress);
            const ldraw = await new Promise<Group>((resolve, reject) => {
                try {
                    (ldrawLoader.parse as any)(text, (group: Group) =>
                        resolve(group)
                    );
                } catch (err) {
                    reject(err);
                }
            });
            if (!this.container || cancellationToken.isCanceled) {
                // The decorator was disposed of by the Bot.
                return false;
            }
            this._setLDraw(ldraw);
            return true;
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to parse LDraw:',
                text,
                err
            );

            return false;
        }
    }

    private _setLDraw(ldraw: Group) {
        const group = new Group();
        group.add(ldraw);

        // Positioning
        group.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
        let box = new Box3();
        box.setFromObject(group);
        let size = new Vector3();
        box.getSize(size);
        let center = new Vector3();
        box.getCenter(center);
        const maxScale = Math.max(size.x, size.y, size.z);

        if (this._scaleMode !== 'absolute') {
            size.divideScalar(maxScale);
            center.divideScalar(maxScale);
            group.scale.divideScalar(maxScale);
        }

        let bottomCenter = new Vector3(-center.x, -center.y, -center.z);

        // Group
        group.position.copy(bottomCenter);
        this.scene = group;
        this.container.add(this.scene);

        this.mesh = findFirstMesh(this.scene);

        // Collider
        const collider = (this.collider = createCube(1));
        this.collider.scale.copy(size);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);

        this.scene.traverse((obj) => {
            if (obj instanceof Mesh) {
                const material = obj.material;
                if (material) {
                    registerMaterial(material);

                    if (material.color) {
                        material[DEFAULT_COLOR] = material.color;
                    }

                    if (
                        typeof material.opacity === 'number' &&
                        !Number.isNaN(material.opacity)
                    ) {
                        material[DEFAULT_OPACITY] = material.opacity;
                    }

                    if (typeof material.transparent === 'boolean') {
                        material[DEFAULT_TRANSPARENT] = material.transparent;
                    }
                }
            }
        });

        this._updateColor(null);
        this._updateOpacity(null);
        this._updateRenderOrder(null);
        this._updateBuildStep(null);
        this.bot3D.updateMatrixWorld(true);
    }

    private async _createJsonObject() {
        this.stroke = null;
        this._canHaveStroke = false;
        let token: CancellationToken = {
            isCanceled: false,
        };
        this._meshCancellationToken = token;

        await this._loadJsonObject(this._address, token);
        // if (this._subShape === 'ldraw') {
        // } else {
        //     await this._parseLDraw(this._address, token);
        // }
    }

    private async _loadJsonObject(
        url: string,
        cancellationToken: CancellationToken
    ) {
        try {
            if (!jsonObjectLoader) {
                jsonObjectLoader = new ObjectLoader();
            }
            const obj = await jsonObjectLoader.loadAsync(url);
            if (!this.container || cancellationToken.isCanceled) {
                // The decorator was disposed of by the Bot.
                return false;
            }
            this._setJsonObject(obj);
            return true;
        } catch (err) {
            console.error(
                '[BotShapeDecorator] Unable to load jsonObject:',
                url,
                err
            );

            return false;
        }
    }

    private _setJsonObject(obj: Object3D) {
        const group = new Group();
        group.add(obj);

        // Positioning
        group.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
        let box = new Box3();
        box.setFromObject(group);
        let size = new Vector3();
        box.getSize(size);
        let center = new Vector3();
        box.getCenter(center);
        const maxScale = Math.max(size.x, size.y, size.z);

        if (this._scaleMode !== 'absolute') {
            size.divideScalar(maxScale);
            center.divideScalar(maxScale);
            group.scale.divideScalar(maxScale);
        }

        let bottomCenter = new Vector3(-center.x, -center.y, -center.z);

        // Group
        group.position.copy(bottomCenter);
        this.scene = group;
        this.container.add(this.scene);

        this.mesh = findFirstMesh(this.scene);

        // Collider
        const collider = (this.collider = createCube(1));
        this.collider.scale.copy(size);
        setColor(collider, 'clear');
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);

        this.scene.traverse((obj) => {
            if (obj instanceof Mesh) {
                const material = obj.material;
                if (material) {
                    registerMaterial(material);

                    if (material.color) {
                        material[DEFAULT_COLOR] = material.color;
                    }

                    if (
                        typeof material.opacity === 'number' &&
                        !Number.isNaN(material.opacity)
                    ) {
                        material[DEFAULT_OPACITY] = material.opacity;
                    }

                    if (typeof material.transparent === 'boolean') {
                        material[DEFAULT_TRANSPARENT] = material.transparent;
                    }
                }
            }
        });

        this._updateColor(null);
        this._updateOpacity(null);
        this._updateRenderOrder(null);
        this._updateBuildStep(null);
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

    private _createSkybox() {
        this.mesh = this.collider = createSkybox(
            new Vector3(0, 0, 0),
            0x000000,
            0.5
        );
        this.container.add(this.mesh);
        this.bot3D.colliders.push(this.collider);
        this.stroke = null;
        this._canHaveStroke = false;
    }

    private _updateMapProvider(calc: BotCalculationContext) {
        if (!this._mapView) {
            return;
        }

        // Get the map provider name from the tag
        const providerName = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'formMapProvider',
            defaultMapProvider
        );

        const apiKey = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'formMapProviderAPIKey',
            null
        );

        // Check if provider has changed
        if (
            this._mapProviderName !== providerName ||
            this._mapProviderApiKey !== apiKey
        ) {
            const provider = getMapProvider(providerName, apiKey);
            this._mapView.setProvider(provider);

            this._mapProviderApiKey = apiKey;
            this._mapProviderName = providerName;

            console.log(`Changed map provider to ${providerName}`);
        }
    }

    private _createMapPlane() {
        // Get the provider name from the tag
        const providerName = calculateStringTagValue(
            null,
            this.bot3D.bot,
            'formMapProvider',
            defaultMapProvider
        );

        const apiKey = calculateStringTagValue(
            null,
            this.bot3D.bot,
            'formMapProviderAPIKey',
            null
        );

        this._mapView = createMapPlane(
            new Vector3(0, 0, 0),
            1,
            providerName,
            apiKey
        );

        this.mesh = null;
        const colliderPlane = (this.collider = createPlane(1));
        setColor(colliderPlane, 'clear');

        this._mapProviderName = providerName;

        this.container.add(this._mapView);
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.stroke = null;

        const coords = parseBotVector(this._address) ?? new Vector2(0, 0);

        this._mapView.setCenter(
            this._mapLODLevel,
            coords.x, // lon
            coords.y // lat
        );
    }

    private _updateCustomMapProviderURL(calc: BotCalculationContext) {
        if (!this._mapView) {
            return;
        }

        // Get custom URL template for tile provider (if any)
        const customURL = calculateStringTagValue(
            calc,
            this.bot3D.bot,
            'mapProviderURL',
            null
        );
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
            this.bot3D.colliders.push(key);
        }

        for (let panel of (keyboard as any).panels) {
            // Don't allow collision for touch
            panel.intersectionVolume = null;
            this.bot3D.colliders.push(panel);
        }

        this._keyboard = keyboard;
        this.container.add(keyboard);
        this.stroke = null;
        this.mesh = null;
        this.collider = null;
        this._canHaveStroke = false;
        this._updateColor(null);
        this._updateOpacity(null);
        this._updateRenderOrder(null);

        // Force the mesh UI to update
        updateMeshUI();
        keyboard.updateMatrixWorld();

        // Go through the keys and add custom intersection volumes for them
        for (let key of (keyboard as any).keys) {
            const volume = new Object3D();
            key.add(volume);
            volume.scale.set(key.size.x, key.size.y, 0.1);
            volume.updateMatrixWorld();
            key.intersectionVolume = volume;
        }
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
        let token = (this._meshCancellationToken = { isCanceled: false });
        if (await this._loadGLTF(HelixUrl, false, token)) {
            this.mesh = this.scene.children[0] as Mesh;
            let material = baseAuxMeshMaterial();
            this.mesh.material = material;
            this._updateColor(null);
            this._updateOpacity(null);
            this._updateRenderOrder(null);
        }
    }

    private async _createEgg() {
        this.stroke = null;
        this.mesh = null;
        this._canHaveStroke = false;
        let token = (this._meshCancellationToken = { isCanceled: false });
        if (await this._loadGLTF(EggUrl, false, token)) {
            this.mesh = this.scene.children[0] as Mesh;
            this._updateColor(null);
            this._updateOpacity(null);
            this._updateRenderOrder(null);
        }
    }

    private _createPointLight() {
        //Create Collider
        const collider = (this.collider = createCube(1));
        setColor(collider, 'clear');
        //Create pointLight
        const pointLight = new PointLight(0xffffff, 1, 10, 2);
        this.light = pointLight;
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(pointLight);
        pointLight.position.set(0, 0, 0);
    }
    private _createAmbientLight() {
        const collider = (this.collider = createCube(1));
        setColor(collider, 'clear');
        const ambientLight = new AmbientLight(0x404040, 1);
        this.light = ambientLight;
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(ambientLight);
        ambientLight.position.set(0, 0, 0);
    }

    private _createDirectionalLight() {
        const collider = (this.collider = createCube(1));
        setColor(collider, 'clear');
        const directionalLight = new DirectionalLight(0xffffff, 0.5);
        this.light = directionalLight;
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(directionalLight);
        directionalLight.position.set(0, 0, 0);
    }

    private _createSpotLight() {
        const collider = (this.collider = createCube(1));
        setColor(collider, 'clear');
        const spotLight = new SpotLight(
            0x00ff00,
            1,
            0,
            Math.PI * 0.3333333333333,
            0,
            2
        ); //color, intensity, distance, angle, penumbra, decay
        this.light = spotLight;
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(spotLight);
        spotLight.position.set(0, 0, 0);

        //Todo
        // spotLight.castShadow = true;

        // spotLight.shadow.mapSize.width = 1024;
        // spotLight.shadow.mapSize.height = 1024;

        // spotLight.shadow.camera.near = 500;
        // spotLight.shadow.camera.far = 4000;
        // spotLight.shadow.camera.fov = 30;
    }
    private _createHemisphereLight() {
        const collider = (this.collider = createCube(1));
        setColor(collider, 'clear');
        const hemisphereLight = new HemisphereLight(0xffffff, 0xffffff, 1);
        this.light = hemisphereLight;
        this.container.add(this.collider);
        this.bot3D.colliders.push(this.collider);
        this.container.add(hemisphereLight);
        hemisphereLight.position.set(0, 0, 0);
    }
    private _updateLightTarget(calc: BotCalculationContext) {
        if (!this._finder) {
            return;
        } else if (
            !(
                this.light instanceof SpotLight ||
                this.light instanceof DirectionalLight
            )
        ) {
            return;
        }
        let lightTarget = calculateBotIds(this.bot3D.bot, 'formLightTarget');

        if (!hasValue(lightTarget)) {
            this.light.target = DEFAULT_LIGHT_TARGET;
            return;
        }

        let hasLightTarget = false;

        for (let id of lightTarget) {
            if (this.bot3D.bot.id === id) continue;
            const bots = this._finder.findBotsById(id);
            const auxBot = bots.find((bot) => {
                return bot instanceof AuxBot3D;
            }) as AuxBot3D;
            if (auxBot) {
                this.light.target = auxBot;
                hasLightTarget = true;
                break;
            }
        }
        if (!hasLightTarget) {
            this.light.target = DEFAULT_LIGHT_TARGET;
        }
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
