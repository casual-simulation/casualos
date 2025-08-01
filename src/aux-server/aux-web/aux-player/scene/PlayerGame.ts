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
import { Game } from '../../shared/scene/Game';
import type PlayerGameView from '../PlayerGameView/PlayerGameView';
import type {
    CameraRig,
    CameraType,
} from '../../shared/scene/CameraRigFactory';
import {
    createCameraRig,
    Perspective_MaxZoom,
    Perspective_MinZoom,
    resizeCameraRig,
} from '../../shared/scene/CameraRigFactory';
import type {
    Texture,
    DirectionalLight,
    AmbientLight,
    Group,
} from '@casual-simulation/three';
import {
    Scene,
    Color,
    OrthographicCamera,
    Vector3,
    Vector2,
    Mesh,
    Ray,
    MathUtils as ThreeMath,
    SphereGeometry,
    MeshBasicMaterial,
    PerspectiveCamera,
} from '@casual-simulation/three';
import { PlayerPageSimulation3D } from './PlayerPageSimulation3D';
import { MiniSimulation3D } from './MiniSimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import type { Simulation3D } from '../../shared/scene/Simulation3D';
import type { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first, map } from 'rxjs/operators';
import { flatMap } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { getPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import type {
    BufferSoundAction,
    BotAction,
    PlaySoundAction,
    CancelSoundAction,
    Bot,
    BotTags,
    BotCursorType,
    Easing,
    RaycastInPortalAction,
    RaycastFromCameraAction,
    CalculateRayFromCameraAction,
    BufferFormAddressGLTFAction,
    StartFormAnimationAction,
    StopFormAnimationAction,
    ListFormAnimationsAction,
    ImportAUXAction,
    LDrawCountBuildStepsAction,
    CalculateViewportCoordinatesFromPositionAction,
    CalculateScreenCoordinatesFromViewportCoordinatesAction,
    CalculateViewportCoordinatesFromScreenCoordinatesAction,
    CapturePortalScreenshotAction,
    CameraPortal,
    Photo,
    CalculateScreenCoordinatesFromPositionAction,
    MapPortalKind,
    AddMapLayerAction,
    RemoveMapLayerAction,
} from '@casual-simulation/aux-common';
import {
    clamp,
    DEFAULT_MINI_PORTAL_VISIBLE,
    DEFAULT_PORTAL_SHOW_FOCUS_POINT,
    DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY,
    hasValue,
    enqueueAsyncResult,
    enqueueAsyncError,
    isBot,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    asyncResult,
    getPortalTag,
    DEFAULT_MAP_PORTAL_VISIBLE,
    DEFAULT_MAP_PORTAL_BASEMAP,
    getDefaultEasing,
    DEFAULT_MINI_PORTAL_HEIGHT,
    realNumberOrDefault,
    VECTOR_TAG_PREFIX,
    asyncError,
    createBotLink,
    formatBotVector,
    getBotsStateFromStoredAux,
    isStoredVersion2,
    DEFAULT_MAP_PORTAL_KIND,
} from '@casual-simulation/aux-common';
import type { TweenCameraPosition } from '../../shared/scene/SceneUtils';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    calculateHitFace,
    createSphere,
} from '../../shared/scene/SceneUtils';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import type { CameraRigControls } from '../../shared/interaction/CameraRigControls';
import type { AuxBotVisualizer } from '../../shared/scene/AuxBotVisualizer';
import type { Simulation } from '@casual-simulation/aux-vm';
import { GameAudio } from '../../shared/scene/GameAudio';
import TWEEN from '@tweenjs/tween.js';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import { Input, MouseButtonId } from '../../shared/scene/Input';
import type { MapSimulation3D } from './MapSimulation3D';
import { ExternalRenderers, SpatialReference } from '../MapUtils';
import { PlayerMapSimulation3D } from './PlayerMapSimulation3D';
import { MiniMapSimulation3D } from './MiniMapSimulation3D';
import type { XRFrame } from '../../shared/scene/xr/WebXRTypes';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { Physics } from '../../shared/scene/Physics';
import { gltfPool } from '../../shared/scene/decorators/BotShapeDecorator';
import { addStoredAuxV2ToSimulation } from '../../shared/SharedUtils';
import { EARTH_RADIUS } from './MapPortalGrid3D';
import { LDrawLoader } from '../../shared/public/ldraw-loader/LDrawLoader';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { loadModules as loadEsriModules } from 'esri-loader';

const MINI_PORTAL_SLIDER_HALF_HEIGHT = 36 / 2;
const MINI_PORTAL_SLIDER_HALF_WIDTH = 30 / 2;

const MINI_PORTAL_MAX_PERCENT = 1;
const MINI_PORTAL_MIN_PERCENT = 0.1;

const MINI_PORTAL_WIDTH_BREAKPOINT = 700;
/**
 * The default width percentage of the miniGridPortal.
 */
const MINI_PORTAL_DEFAULT_WIDTH = 0.8;

/**
 * The default width percentage that the miniGridPortal should use on small devices (< breakpoint).
 */
const MINI_PORTAL_SMALL_WIDTH = 0.9;

/**
 * The default padding needed for the available height padding.
 */
const MINI_PORTAL_DEFAULT_HEIGHT_PADDING = 40;

const _tempVector = new Vector3();

export class PlayerGame extends Game {
    gameView: PlayerGameView;

    playerSimulations: PlayerPageSimulation3D[] = [];
    miniSimulations: MiniSimulation3D[] = [];
    mapSimulations: PlayerMapSimulation3D[] = [];
    miniMapSimulations: MiniMapSimulation3D[] = [];
    miniCameraRig: CameraRig = null;
    miniViewport: Viewport = null;
    mapViewport: Viewport = null;
    miniMapViewport: Viewport = null;
    mapCameraRig: CameraRig = null;
    miniMapCameraRig: CameraRig = null;
    showMiniPortalCameraRigHome: boolean = false;
    disableCanvasTransparency: boolean =
        DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY;

    startZoom: number;
    startAspect: number;

    private miniScene: Scene;
    private mapScene: Scene;
    private miniMapScene: Scene;
    private _miniAmbientLight: AmbientLight;
    private _miniDirectionalLight: DirectionalLight;
    private _miniHDRAddress: string;
    private _simulationSubs: Map<string, Subscription> = new Map();

    // /**
    //  * A scene that is used to allow the main scene to render
    //  * without drawing anything to the screen
    //  */
    // private emptyScene: Scene;

    // private mapRenderer: WebGLRenderer;
    private mapDirectionalLight: DirectionalLight;
    private mapAmbientLight: AmbientLight;
    private miniMapAmbientLight: AmbientLight;
    private miniMapDirectionalLight: DirectionalLight;

    private mapPortalVisible: boolean = DEFAULT_MAP_PORTAL_VISIBLE;
    private miniMapPortalVisible: boolean = false;

    private _slider: HTMLElement;
    private _resizingMiniPortal: boolean = false;

    /**
     * The mouse position that the miniGridPortal resize operation started at.
     * When resizing, we compare this value against the final value to determine how much larger/smaller the miniGridPortal should be.
     */
    private _startResizeClientPos: Vector2 = null;
    private _currentResizeClientPos: Vector2 = null;
    private _startMiniPortalHeight: number;
    private _currentMiniHDRAddress: string;
    private _screenshotTasks: {
        taskId: number | string;
        sim: BrowserSimulation;
        portal: CameraPortal;
    }[] = [];
    private _mapGlobeMask: Mesh;
    private _miniMapGlobeMask: Mesh<SphereGeometry, MeshBasicMaterial>;

    private get slider() {
        if (!this._slider) {
            this._slider = document.querySelector(
                '.slider-hidden'
            ) as HTMLElement;
        }
        return this._slider;
    }

    setupDelay: boolean = false;

    miniPortalVisible: boolean = DEFAULT_MINI_PORTAL_VISIBLE;

    /**
     * The height that was last configured for the miniGridPortal. This can be set directly by the user.
     * Represented as a percentage of the available height that the portal can take.
     */
    private _miniPortalConfiguredHeight: number;

    /**
     * The current height of the miniGridPortal represented as a percentage of
     * the available height that the portal can take.
     * This can be manipulated by the user via resizing the portal.
     */
    private _miniPortalHeight: number;

    /**
     * The available height that can be used by the miniGridPortal in px.
     */
    private _miniPortalAvailableHeight: number;

    /**
     * The maximum width of the miniGridPortal in px.
     */
    private _miniPortalMaxWidth: number = 700;

    /**
     * The map of layer IDs to the object URLs that were created for the GeoJSON data.
     */
    private _geoJsonUrls: Map<string, string> = new Map();

    defaultPlayerZoom: number = null;
    defaultPlayerRotationX: number = null;
    defaultPlayerRotationY: number = null;

    defaultMiniZoom: number = null;
    defaultMiniRotationX: number = null;
    defaultMiniRotationY: number = null;

    miniPortalControls: CameraRigControls;
    invOffsetCurr: number = 0;
    invOffsetDelta: number = 0;

    panValueCurr: number = 0;
    startOffset: number = 0;

    menuOffset: number = 15;

    audio: GameAudio;

    miniPortalFocusPoint: Mesh;
    mainFocusPoint: Mesh;

    constructor(gameView: PlayerGameView) {
        super(gameView);
    }

    getBackground(): Color | Texture {
        return this._getSimulationValue(
            this.playerSimulations,
            'backgroundColor'
        );
    }

    getBackgroundAddress() {
        return this._getSimulationValue(
            this.playerSimulations,
            'backgroundAddress'
        );
    }

    getDefaultLighting(): boolean {
        return this._getSimulationValue(
            this.playerSimulations,
            'defaultLighting'
        );
    }

    getPortalHDRAddress() {
        return this._getSimulationValue(
            this.playerSimulations,
            'portalHDRAddress'
        );
    }

    getPannable(): boolean {
        return this._getSimulationValue(this.playerSimulations, 'pannable');
    }

    getPanMinX(): number {
        return this._getSimulationValue(this.playerSimulations, 'panMinX');
    }

    getPanMaxX(): number {
        return this._getSimulationValue(this.playerSimulations, 'panMaxX');
    }

    getPanMinY(): number {
        return this._getSimulationValue(this.playerSimulations, 'panMinY');
    }

    getPanMaxY(): number {
        return this._getSimulationValue(this.playerSimulations, 'panMaxY');
    }

    getZoomable(): boolean {
        return this._getSimulationValue(this.playerSimulations, 'zoomable');
    }

    getZoomMin(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'zoomMin',
            Orthographic_MinZoom
        );
    }

    getZoomMax(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'zoomMax',
            Orthographic_MaxZoom
        );
    }

    getPerspectiveZoomMin(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'zoomMin',
            Perspective_MinZoom
        );
    }

    getPerspectiveZoomMax(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'zoomMax',
            Perspective_MaxZoom
        );
    }

    getRotatable(): boolean {
        return this._getSimulationValue(this.playerSimulations, 'rotatable');
    }

    getCursor(): BotCursorType {
        return this._getSimulationValue(this.playerSimulations, 'cursor');
    }

    getPixelRatio(): number {
        return this._getSimulationValue(this.playerSimulations, 'pixelRatio');
    }

    getMiniPortalVisible(): boolean {
        return this._getSimulationValue(
            this.miniSimulations,
            'hasDimension',
            DEFAULT_MINI_PORTAL_VISIBLE,
            (hasDimension) => hasDimension === true
        );
    }

    getMiniPortalHeight(): number {
        return this._getSimulationValue(this.miniSimulations, 'height', 1);
    }

    getMiniPortalHeightPadding(): number {
        const width = this.getMiniPortalWidth();
        if (width >= 1) {
            return 0;
        }
        return MINI_PORTAL_DEFAULT_HEIGHT_PADDING;
    }

    getMiniPortalWidth(): number {
        return this._getSimulationValue(this.miniSimulations, 'width', null);
    }

    getMiniPortalPannable(): boolean {
        return this._getSimulationValue(this.miniSimulations, 'pannable');
    }

    getMiniPortalPanMinX(): number {
        return this._getSimulationValue(this.miniSimulations, 'panMinX');
    }

    getMiniPortalPanMaxX(): number {
        return this._getSimulationValue(this.miniSimulations, 'panMaxX');
    }

    getMiniPortalPanMinY(): number {
        return this._getSimulationValue(this.miniSimulations, 'panMinY');
    }

    getMiniPortalPanMaxY(): number {
        return this._getSimulationValue(this.miniSimulations, 'panMaxY');
    }

    getMiniPortalZoomable(): boolean {
        return this._getSimulationValue(this.miniSimulations, 'zoomable');
    }

    getMiniPortalRotatable(): boolean {
        return this._getSimulationValue(this.miniSimulations, 'rotatable');
    }

    getMiniPortalResizable(): boolean {
        return this._getSimulationValue(this.miniSimulations, 'resizable');
    }

    getMiniPortalCursor(): BotCursorType {
        return this._getSimulationValue(this.miniSimulations, 'cursor');
    }

    getMiniMapPortalResizable(): boolean {
        return this._getSimulationValue(this.miniMapSimulations, 'resizable');
    }

    getMiniMapPortalCursor(): BotCursorType {
        return this._getSimulationValue(this.miniMapSimulations, 'cursor');
    }

    getPlayerZoom(): number {
        return this._getSimulationValue(this.playerSimulations, 'playerZoom');
    }

    getPlayerRotationX(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'playerRotationX'
        );
    }

    getPlayerRotationY(): number {
        return this._getSimulationValue(
            this.playerSimulations,
            'playerRotationY'
        );
    }

    getPlayerShowFocusPoint(): boolean {
        return this._getSimulationValue(
            this.playerSimulations,
            'showFocusPoint',
            DEFAULT_PORTAL_SHOW_FOCUS_POINT
        );
    }

    getMiniPortalZoom(): number {
        return this._getSimulationValue(this.miniSimulations, 'playerZoom');
    }

    getMiniPortalRotationX(): number {
        return this._getSimulationValue(
            this.miniSimulations,
            'playerRotationX'
        );
    }

    getMiniPortalRotationY(): number {
        return this._getSimulationValue(
            this.miniSimulations,
            'playerRotationY'
        );
    }

    getMiniDefaultLighting(): boolean {
        return this._getSimulationValue(
            this.miniSimulations,
            'defaultLighting'
        );
    }

    getMiniPortalHDRAddress() {
        return this._getSimulationValue(
            this.miniSimulations,
            'portalHDRAddress'
        );
    }

    getMiniPortalColor(): Color | Texture {
        return this._getSimulationValue(
            this.miniSimulations,
            'backgroundColor'
        );
    }

    getMiniPortalShowFocusPoint(): boolean {
        return this._getSimulationValue(
            this.miniSimulations,
            'showFocusPoint',
            DEFAULT_PORTAL_SHOW_FOCUS_POINT
        );
    }

    getDisableCanvasTransparency(): boolean {
        return this._getSimulationValue(
            this.playerSimulations,
            'disableCanvasTransparency',
            DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY
        );
    }

    getMiniMapPortalWidth(): number {
        return this._getSimulationValue(this.miniMapSimulations, 'width', null);
    }

    getMiniMapPortalHeight(): number {
        return this._getSimulationValue(
            this.miniMapSimulations,
            'height',
            null
        );
    }

    getMiniMapPortalHeightPadding(): number {
        const width = this.getMiniMapPortalWidth();
        if (width >= 1) {
            return 0;
        }
        return MINI_PORTAL_DEFAULT_HEIGHT_PADDING;
    }

    getGridPortalVisible(): boolean {
        return this._getSimulationValue(
            this.playerSimulations,
            'hasDimension',
            false,
            (hasDimension) => hasDimension === true
        );
    }

    getMapPortalVisible(): boolean {
        return this._getSimulationValue(
            this.mapSimulations,
            'hasDimension',
            DEFAULT_MAP_PORTAL_VISIBLE,
            (hasDimension) => hasDimension === true
        );
    }

    getMiniMapPortalVisible(): boolean {
        return this._getSimulationValue(
            this.miniMapSimulations,
            'hasDimension',
            false,
            (hasDimension) => hasDimension === true
        );
    }

    getMapPortalBasemap(): string {
        return this._getSimulationValue(
            this.mapSimulations,
            'basemap',
            DEFAULT_MAP_PORTAL_BASEMAP
        );
    }

    getMiniMapPortalBasemap(): string {
        return this._getSimulationValue(
            this.miniMapSimulations,
            'basemap',
            DEFAULT_MAP_PORTAL_BASEMAP
        );
    }

    getMapPortalKind(): MapPortalKind {
        return this._getSimulationValue(
            this.mapSimulations,
            'kind',
            DEFAULT_MAP_PORTAL_KIND
        );
    }

    getMiniMapPortalKind(): MapPortalKind {
        return this._getSimulationValue(
            this.miniMapSimulations,
            'kind',
            DEFAULT_MAP_PORTAL_KIND
        );
    }

    private _getSimulationValue<T, K extends keyof T>(
        simulations: T[],
        name: K,
        defaultValue: T[K] = null,
        condition: (value: T[K]) => boolean = (v) => v !== null
    ): T[K] {
        for (let i = 0; i < simulations.length; i++) {
            const sim = simulations[i];
            if (condition(sim[name])) {
                return sim[name];
            }
        }

        return defaultValue;
    }

    getViewports(): Viewport[] {
        return [
            this.mainViewport,
            this.miniViewport,
            this.mapViewport,
            this.miniMapViewport,
        ];
    }
    getCameraRigs(): CameraRig[] {
        return [
            this.mainCameraRig,
            this.miniCameraRig,
            this.mapCameraRig,
            this.miniMapCameraRig,
        ];
    }
    getSimulations(): Simulation3D[] {
        return [
            ...this.playerSimulations,
            ...this.miniSimulations,
            ...this.mapSimulations,
            ...this.miniMapSimulations,
        ];
    }
    getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.gameView.$refs.miniGridPortal, this.slider];
    }
    getUIZoomElements(): HTMLElement[] {
        return [<HTMLElement>this.gameView.$refs.menuElement];
    }
    getMiniPortalViewport(): Viewport {
        return this.miniViewport;
    }
    getMiniPortalCameraRig(): CameraRig {
        return this.miniCameraRig;
    }
    getMapPortalViewport(): Viewport {
        return this.mapViewport;
    }
    getMiniMapPortalViewport(): Viewport {
        return this.miniMapViewport;
    }
    getMapPortalCameraRig(): CameraRig {
        return this.mapCameraRig;
    }
    getMiniMapPortalCameraRig(): CameraRig {
        return this.miniMapCameraRig;
    }
    findAllBotsById(id: string): AuxBotVisualizer[] {
        return [
            ...flatMap(this.playerSimulations, (s) => s.findBotsById(id)),
            ...flatMap(this.miniSimulations, (s) => s.findBotsById(id)),
            ...flatMap(this.mapSimulations, (s) => s.findBotsById(id)),
            ...flatMap(this.miniMapSimulations, (s) => s.findBotsById(id)),
        ];
    }
    setGridsVisible(visible: boolean): void {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }
    setWorldGridVisible(visible: boolean): void {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }
    setupInteraction(): BaseInteractionManager {
        return new PlayerInteractionManager(this);
    }
    addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void {
        this.gameView.addSidebarItem(id, text, click, icon, group);
    }
    removeSidebarItem(id: string): void {
        this.gameView.removeSidebarItem(id);
    }
    removeSidebarGroup(group: string): void {
        this.gameView.removeSidebarGroup(group);
    }

    /**
     * Find miniGridPortal Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findMiniSimulation3D(sim: Simulation): MiniSimulation3D {
        return this.miniSimulations.find((s) => s.simulation === sim);
    }

    /**
     * Find Player Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findPlayerSimulation3D(sim: Simulation): PlayerPageSimulation3D {
        return this.playerSimulations.find((s) => s.simulation === sim);
    }

    /**
     * Find Map Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findMapSimulation3D(sim: Simulation): MapSimulation3D {
        return this.mapSimulations.find((s) => s.simulation === sim);
    }

    /**
     * Find Mini Map Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findMiniMapSimulation3D(sim: Simulation): MapSimulation3D {
        return this.miniMapSimulations.find((s) => s.simulation === sim);
    }

    dispose(): void {
        super.dispose();

        this.removeSidebarItem('debug_mode');
        this.removeSidebarGroup('simulations');
    }

    protected async onBeforeSetupComplete() {
        this.subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(
                    mergeMap((sim) =>
                        sim.connection.syncStateChanged.pipe(
                            first((sync) => sync),
                            map(() => sim)
                        )
                    ),
                    tap((sim) => {
                        this.simulationAdded(sim);
                    })
                )
                .subscribe()
        );

        this.subs.push(
            appManager.simulationManager.simulationRemoved
                .pipe(
                    tap((sim) => {
                        this.simulationRemoved(sim);
                    })
                )
                .subscribe()
        );
    }

    private simulationAdded(sim: BrowserSimulation) {
        const removeListeners = (s: Simulation3D) => {
            s.onBotAdded.removeListener(this.onBotAdded.invoke);
            s.onBotRemoved.removeListener(this.onBotRemoved.invoke);
            s.onBotUpdated.removeListener(this.onBotUpdated.invoke);
        };

        let sub = new Subscription();
        this._simulationSubs.set(sim.id, sub);

        const playerSim3D = new PlayerPageSimulation3D(this, sim);
        playerSim3D.init();
        playerSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        playerSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        playerSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        sub.add(() => {
            const index = this.playerSimulations.findIndex(
                (s) => s.simulation.id === sim.id
            );
            if (index >= 0) {
                const removed = this.playerSimulations.splice(index, 1);
                removed.forEach((s) => {
                    removeListeners(s);
                    s.unsubscribe();
                    this.mainScene.remove(s);
                });
            }
        });

        this.playerSimulations.push(playerSim3D);
        this.mainScene.add(playerSim3D);

        //
        // Create miniGridPortal Simulation
        //
        const miniPortalSim3D = new MiniSimulation3D(this, sim);
        miniPortalSim3D.init();
        miniPortalSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        miniPortalSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        miniPortalSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.miniSimulations.push(miniPortalSim3D);
        this.miniScene.add(miniPortalSim3D);

        sub.add(() => {
            //
            // Remove miniGridPortal Simulation
            //
            const index = this.miniSimulations.findIndex(
                (s) => s.simulation.id == sim.id
            );

            if (index >= 0) {
                const removed = this.miniSimulations.splice(index, 1);
                removed.forEach((s) => {
                    removeListeners(s);
                    s.unsubscribe();
                    this.miniScene.remove(s);
                });
            }
        });

        const mapPortalSim3D = new PlayerMapSimulation3D(this, sim);
        mapPortalSim3D.coordinateTransformer =
            this.gameView.getMapCoordinateTransformer();
        mapPortalSim3D.mapView = this.gameView.getMapView();
        mapPortalSim3D.init();
        mapPortalSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        mapPortalSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        mapPortalSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.mapSimulations.push(mapPortalSim3D);
        this.mapScene.add(mapPortalSim3D);

        sub.add(() => {
            const index = this.mapSimulations.findIndex(
                (s) => s.simulation.id == sim.id
            );

            if (index >= 0) {
                const removed = this.mapSimulations.splice(index, 1);
                removed.forEach((s) => {
                    removeListeners(s);
                    s.unsubscribe();
                    this.mapScene.remove(s);
                });
            }
        });

        const miniMapPortalSim3D = new MiniMapSimulation3D(this, sim);
        miniMapPortalSim3D.coordinateTransformer =
            this.gameView.getMiniMapCoordinateTransformer();
        miniMapPortalSim3D.mapView = this.gameView.getMiniMapView();
        miniMapPortalSim3D.init();
        miniMapPortalSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        miniMapPortalSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        miniMapPortalSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.miniMapSimulations.push(miniMapPortalSim3D);
        this.miniMapScene.add(miniMapPortalSim3D);

        sub.add(() => {
            const index = this.miniMapSimulations.findIndex(
                (s) => s.simulation.id == sim.id
            );

            if (index >= 0) {
                const removed = this.miniMapSimulations.splice(index, 1);
                removed.forEach((s) => {
                    removeListeners(s);
                    s.unsubscribe();
                    this.miniMapScene.remove(s);
                });
            }
        });

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe((e) => {
                if (e.type === 'go_to_dimension') {
                    this.resetCameras();
                    playerSim3D.simulation.helper.updateBot(
                        playerSim3D.simulation.helper.userBot,
                        {
                            tags: {
                                gridPortal: e.dimension,
                            },
                        }
                    );
                } else if (e.type === 'import_aux') {
                    this.importAUX(sim, e);
                } else if (e.type === 'play_sound') {
                    this.playAudio(sim, e);
                } else if (e.type === 'buffer_sound') {
                    this.bufferAudio(sim, e);
                } else if (e.type === 'cancel_sound') {
                    this.cancelAudio(sim, e);
                } else if (e.type === 'enable_ar') {
                    if (e.enabled) {
                        this.startAR(e.options);
                    } else {
                        this.stopAR();
                    }
                } else if (e.type === 'enable_vr') {
                    if (e.enabled) {
                        this.startVR(e.options);
                    } else {
                        this.stopVR();
                    }
                } else if (e.type === 'ar_supported') {
                    this.arSupported(sim, e);
                } else if (e.type === 'vr_supported') {
                    this.vrSupported(sim, e);
                } else if (e.type === 'replace_drag_bot') {
                    this.dragBot(playerSim3D, miniPortalSim3D, e.bot);
                } else if (e.type === 'focus_on') {
                    this.tweenCameraToBot(e);
                } else if (e.type === 'focus_on_position') {
                    const targetPortal = hasValue(e.portal)
                        ? getPortalTag(e.portal)
                        : null;
                    const sim =
                        targetPortal === 'mapPortal'
                            ? mapPortalSim3D
                            : targetPortal === 'miniMapPortal'
                            ? miniMapPortalSim3D
                            : targetPortal === 'miniGridPortal'
                            ? miniPortalSim3D
                            : playerSim3D;

                    let position: TweenCameraPosition;
                    const cameraRig = sim.getMainCameraRig();
                    if (cameraRig.cancelFocus && cameraRig.focusOnPosition) {
                        position = {
                            type: 'grid',
                            position: new Vector3(
                                realNumberOrDefault(e.position.x, 0),
                                realNumberOrDefault(e.position.y, 0),
                                realNumberOrDefault(e.position.z, 0)
                            ),
                        };
                    } else {
                        const gridScale = sim.getDefaultGridScale();
                        position = {
                            type: 'world',
                            position: new Vector3(
                                realNumberOrDefault(e.position.x, 0) *
                                    gridScale,
                                realNumberOrDefault(e.position.y, 0) *
                                    gridScale,
                                realNumberOrDefault(e.position.z, 0) * gridScale
                            ),
                        };
                    }

                    this.tweenCameraToPosition(
                        cameraRig,
                        position,
                        e,
                        sim.simulation,
                        e.taskId
                    );
                } else if (e.type === 'cancel_animation') {
                    this.getInteraction().clearOperationsOfType(
                        TweenCameraToOperation
                    );
                    sim.helper.transaction(asyncResult(e.taskId, null));
                } else if (e.type === 'enable_pov') {
                    if (e.enabled) {
                        this.startPOV(e);
                    } else {
                        this.stopPOV();
                    }
                } else if (e.type === 'media_permission') {
                    this.getMediaPermission(sim, e);
                } else if (e.type === 'get_average_frame_rate') {
                    const frameRate = this.time.frameRate;
                    sim.helper.transaction(asyncResult(e.taskId, frameRate));
                } else if (e.type === 'raycast_from_camera') {
                    this._raycastFromCamera(sim, e);
                } else if (e.type === 'raycast_in_portal') {
                    this._raycastInPortal(sim, e);
                } else if (e.type === 'calculate_camera_ray') {
                    this._calculateCameraRay(sim, e);
                } else if (
                    e.type === 'calculate_viewport_coordinates_from_position'
                ) {
                    this._calculateViewportCoordinatesFromPosition(sim, e);
                } else if (
                    e.type ===
                    'calculate_screen_coordinates_from_viewport_coordinates'
                ) {
                    this._calculateScreenCoordinatesFromViewportCoordinates(
                        sim,
                        e
                    );
                } else if (
                    e.type ===
                    'calculate_viewport_coordinates_from_screen_coordinates'
                ) {
                    this._calculateViewportCoordinatesFromScreenCoordinates(
                        sim,
                        e
                    );
                } else if (
                    e.type === 'calculate_screen_coordinates_from_position'
                ) {
                    this._calculateScreenCoordinatesFromPosition(sim, e);
                } else if (e.type === 'buffer_form_address_gltf') {
                    this._bufferFormAddressGltf(sim, e);
                } else if (e.type === 'start_form_animation') {
                    this._startFormAnimation(sim, e);
                } else if (e.type === 'stop_form_animation') {
                    this._stopFormAnimation(sim, e);
                } else if (e.type === 'list_form_animations') {
                    this._listFormAnimations(sim, e);
                } else if (e.type === 'ldraw_count_build_steps') {
                    this._countLDrawBuildSteps(sim, e);
                } else if (e.type === 'capture_portal_screenshot') {
                    this._capturePortalScreenshot(sim, e);
                } else if (e.type === 'add_map_layer') {
                    this._addMapLayer(sim, e);
                } else if (e.type === 'remove_map_layer') {
                    this._removeMapLayer(sim, e);
                }
            }),
            sub
        );
    }

    private _removeMapLayer(sim: BrowserSimulation, e: RemoveMapLayerAction) {
        try {
            if (this._geoJsonUrls.has(e.layerId)) {
                // Revoke the object URL if it was created for a GeoJSON layer
                const url = this._geoJsonUrls.get(e.layerId);
                try {
                    URL.revokeObjectURL(url);
                } catch (revokeError) {
                    console.warn('Failed to revoke object URL:', revokeError);
                }
                this._geoJsonUrls.delete(e.layerId);
            }
            this.gameView.removeMapLayer(e.layerId);
            if (hasValue(e.taskId)) {
                sim.helper.transaction(asyncResult(e.taskId, null));
            }
        } catch (err) {
            console.error('Error removing map layer:', err);
            if (hasValue(e.taskId)) {
                sim.helper.transaction(asyncError(e.taskId, err));
            }
        }
    }

    private async _addMapLayer(sim: BrowserSimulation, e: AddMapLayerAction) {
        try {
            // Add the map layer
            const portalTag = getPortalTag(e.portal);

            const layerId = uuid();
            let layer: __esri.Layer = null;
            if (e.layer.type === 'geojson') {
                const [GeoJSONLayer] = (await loadEsriModules([
                    'esri/layers/GeoJSONLayer',
                ])) as [typeof __esri.GeoJSONLayer];

                let url: string;
                if (e.layer.data) {
                    const blob = new Blob([JSON.stringify(e.layer.data)], {
                        type: 'application/json',
                    });
                    url = URL.createObjectURL(blob);
                    this._geoJsonUrls.set(layerId, url);
                } else {
                    url = e.layer.url;
                }

                if (!url) {
                    throw new Error(
                        'No URL or data provided for GeoJSON layer.'
                    );
                }

                layer = new GeoJSONLayer({
                    url,
                    copyright: e.layer.copyright,
                });
            }

            if (!layer) {
                throw new Error(
                    `Unsupported layer type: ${e.layer.type}. Only 'geojson' is supported.`
                );
            }

            if (portalTag === 'mapPortal') {
                this.gameView.addMapLayer(layerId, layer);
            } else {
                this.gameView.addMiniMapLayer(layerId, layer);
            }

            if (hasValue(e.taskId)) {
                sim.helper.transaction(asyncResult(e.taskId, layerId));
            }
        } catch (err) {
            console.error('Error adding map layer:', err);
            if (hasValue(e.taskId)) {
                sim.helper.transaction(asyncError(e.taskId, err));
            }
        }
    }

    private simulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulationSubs.get(sim.id);

        if (sub) {
            this._simulationSubs.delete(sim.id);
            sub.unsubscribe();
        }
    }

    private _capturePortalScreenshot(
        sim: BrowserSimulation,
        e: CapturePortalScreenshotAction
    ) {
        if (e.portal === 'grid') {
            this._screenshotTasks.push({
                taskId: e.taskId,
                sim: sim,
                portal: 'grid',
            });
        } else {
            sim.helper.transaction(
                asyncError(e.taskId, 'Portal type not supported!')
            );
        }
    }

    private _raycastFromCamera(sim: Simulation, e: RaycastFromCameraAction) {
        const portalTag = getPortalTag(e.portal);
        const _3dSim = this._findSimulationForPortalTag(sim, portalTag);
        let success = false;
        if (_3dSim) {
            const result = this.interaction.findHitsFromScreenPosition(
                _3dSim.getMainCameraRig(),
                new Vector2(e.viewportCoordinates.x, e.viewportCoordinates.y)
            );

            const defaultGridScale = _3dSim.getDefaultGridScale();
            const converted = this._convertRaycastResult(
                result,
                defaultGridScale
            );
            if (result) {
                sim.helper.transaction(asyncResult(e.taskId, converted, true));
                success = true;
            }
        }

        if (!success) {
            sim.helper.transaction(asyncResult(e.taskId, null));
        }
    }

    private _raycastInPortal(sim: Simulation, e: RaycastInPortalAction) {
        const portalTag = getPortalTag(e.portal);
        const _3dSim = this._findSimulationForPortalTag(sim, portalTag);
        let success = false;
        if (_3dSim) {
            const defaultGridScale = _3dSim.getDefaultGridScale();

            const result = this.interaction.findHitsFromRay(
                _3dSim.getMainCameraRig(),
                new Ray(
                    new Vector3(
                        e.origin.x * defaultGridScale,
                        e.origin.y * defaultGridScale,
                        e.origin.z * defaultGridScale
                    ),
                    new Vector3(e.direction.x, e.direction.y, e.direction.z)
                )
            );

            const converted = this._convertRaycastResult(
                result,
                defaultGridScale
            );
            if (result) {
                sim.helper.transaction(asyncResult(e.taskId, converted, true));
                success = true;
            }
        }

        if (!success) {
            sim.helper.transaction(asyncResult(e.taskId, null));
        }
    }

    private _calculateCameraRay(
        sim: Simulation,
        e: CalculateRayFromCameraAction
    ) {
        const portalTag = getPortalTag(e.portal);
        const _3dSim = this._findSimulationForPortalTag(sim, portalTag);
        if (_3dSim) {
            const rig = _3dSim.getMainCameraRig();
            const gridScale = _3dSim.getDefaultGridScale();
            const ray = Physics.rayAtScreenPos(
                new Vector2(e.viewportCoordinates.x, e.viewportCoordinates.y),
                rig.mainCamera
            );

            const origin = convertVector3(ray.origin, 1 / gridScale);
            const direction = convertVector3(ray.direction, 1);

            sim.helper.transaction(
                asyncResult(
                    e.taskId,
                    {
                        origin,
                        direction,
                    },
                    true
                )
            );
        } else {
            sim.helper.transaction(asyncResult(e.taskId, null));
        }
    }

    private _calculateViewportCoordinatesFromPosition(
        sim: Simulation,
        e: CalculateViewportCoordinatesFromPositionAction
    ) {
        const _3dSim = this._findSimulationForPortalTag(
            sim,
            getPortalTag(e.portal)
        );

        if (_3dSim) {
            const rig = _3dSim.getMainCameraRig();
            const gridScale = _3dSim.getDefaultGridScale();

            if (_3dSim.coordinateTransformer) {
                const coordinateTransform = _3dSim.coordinateTransformer(
                    e.position
                );
                _tempVector.set(0, 0, 0);
                _tempVector.applyMatrix4(coordinateTransform);
            } else {
                _tempVector.set(
                    e.position.x * gridScale,
                    e.position.y * gridScale,
                    e.position.z * gridScale
                );
            }

            _tempVector.project(rig.mainCamera);

            const viewportPosition = convertVector2(_tempVector);

            sim.helper.transaction(
                asyncResult(e.taskId, viewportPosition, true)
            );
        } else {
            sim.helper.transaction(asyncResult(e.taskId, null));
        }
    }

    private _calculateViewportCoordinatesFromScreenCoordinates(
        sim: BrowserSimulation,
        e: CalculateViewportCoordinatesFromScreenCoordinatesAction
    ) {
        try {
            const portalTag = getPortalTag(e.portal);
            const _3dSim = this._findSimulationForPortalTag(sim, portalTag);
            if (_3dSim) {
                const rig = _3dSim.getMainCameraRig();
                const viewportCoordinates = Input.screenPositionForViewport(
                    new Vector2(e.coordinates.x, e.coordinates.y),
                    rig.viewport
                );
                sim.helper.transaction(
                    asyncResult(
                        e.taskId,
                        convertVector2(viewportCoordinates),
                        true
                    )
                );
            } else {
                sim.helper.transaction(asyncResult(e.taskId, null));
            }
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private _calculateScreenCoordinatesFromViewportCoordinates(
        sim: BrowserSimulation,
        e: CalculateScreenCoordinatesFromViewportCoordinatesAction
    ) {
        try {
            const portalTag = getPortalTag(e.portal);
            const _3dSim = this._findSimulationForPortalTag(sim, portalTag);
            if (_3dSim) {
                const rig = _3dSim.getMainCameraRig();
                const pagePosition = Input.pagePositionForViewport(
                    new Vector2(e.coordinates.x, e.coordinates.y),
                    rig.viewport
                );
                sim.helper.transaction(
                    asyncResult(e.taskId, convertVector2(pagePosition), true)
                );
            } else {
                sim.helper.transaction(asyncResult(e.taskId, null));
            }
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private _calculateScreenCoordinatesFromPosition(
        sim: BrowserSimulation,
        e: CalculateScreenCoordinatesFromPositionAction
    ) {
        try {
            const _3dSim = this._findSimulationForPortalTag(
                sim,
                getPortalTag(e.portal)
            );

            if (_3dSim) {
                const rig = _3dSim.getMainCameraRig();
                const gridScale = _3dSim.getDefaultGridScale();

                const results: string[] = [];

                for (let position of e.coordinates) {
                    if (_3dSim.coordinateTransformer) {
                        const coordinateTransform =
                            _3dSim.coordinateTransformer(position);
                        _tempVector.set(0, 0, 0);
                        _tempVector.applyMatrix4(coordinateTransform);
                    } else {
                        _tempVector.set(
                            position.x * gridScale,
                            position.y * gridScale,
                            position.z * gridScale
                        );
                    }

                    _tempVector.project(rig.mainCamera);

                    // convert to screen position
                    const pagePosition = Input.pagePositionForViewport(
                        _tempVector,
                        rig.viewport
                    );

                    results.push(convertVector2(pagePosition));
                }

                sim.helper.transaction(asyncResult(e.taskId, results, true));
            } else {
                sim.helper.transaction(asyncResult(e.taskId, []));
            }
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private async _bufferFormAddressGltf(
        sim: Simulation,
        e: BufferFormAddressGLTFAction
    ) {
        try {
            await gltfPool.loadGLTF(e.address);
            sim.helper.transaction(asyncResult(e.taskId, null));
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private async _startFormAnimation(
        sim: Simulation,
        e: StartFormAnimationAction
    ) {
        try {
            const sim3Ds = this.getSimulations().filter(
                (s) => s.simulation === sim
            );
            let promises = [] as Promise<any>[];

            for (let sim of sim3Ds) {
                const promise = sim.animation.startAnimation(e);
                if (promise) {
                    promises.push(promise);
                }
            }

            await Promise.all(promises);

            sim.helper.transaction(asyncResult(e.taskId, null));
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private async _stopFormAnimation(
        sim: Simulation,
        e: StopFormAnimationAction
    ) {
        try {
            const sim3Ds = this.getSimulations().filter(
                (s) => s.simulation === sim
            );
            let promises = [] as Promise<any>[];

            for (let sim of sim3Ds) {
                const promise = sim.animation.stopAnimation(e);
                if (promise) {
                    promises.push(promise);
                }
            }

            await Promise.all(promises);

            sim.helper.transaction(asyncResult(e.taskId, null));
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private async _listFormAnimations(
        sim: Simulation,
        e: ListFormAnimationsAction
    ) {
        try {
            const sim3Ds = this.getSimulations().filter(
                (s) => s.simulation === sim
            );

            for (let sim3D of sim3Ds) {
                const animations = await sim3D.animation.listFormAnimations(e);
                sim.helper.transaction(asyncResult(e.taskId, animations));

                return;
            }

            sim.helper.transaction(asyncResult(e.taskId, []));
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private async _countLDrawBuildSteps(
        sim: Simulation,
        e: LDrawCountBuildStepsAction
    ) {
        try {
            const loader = new LDrawLoader();
            const ldraw: Group = e.address
                ? await loader.loadAsync(e.address)
                : await new Promise<Group>((resolve, reject) => {
                      try {
                          (loader.parse as any)(e.text, (group: Group) =>
                              resolve(group)
                          );
                      } catch (err) {
                          reject(err);
                      }
                  });
            const steps = ldraw.userData.numBuildingSteps;
            sim.helper.transaction(asyncResult(e.taskId, steps));
        } catch (err) {
            sim.helper.transaction(asyncError(e.taskId, err.toString()));
        }
    }

    private _convertRaycastResult(
        result: ReturnType<BaseInteractionManager['findHitsFromRay']>,
        defaultGridScale: number
    ) {
        if (result) {
            let intersections = [] as any[];
            for (let hit of result.hits) {
                const found = this.interaction.findGameObjectForHit(hit);
                if (found && found instanceof AuxBot3D) {
                    const scale = 1 / found.gridScale;
                    intersections.push({
                        bot: createBotLink([found.bot.id]),
                        distance: hit.distance,
                        point: convertVector3(hit.point, scale),
                        normal: convertVector3(hit.face.normal, 1),
                        uv: convertVector2(hit.uv),
                        portal: found.dimensionGroup.portalTag,
                        dimension: found.dimension,
                        face: calculateHitFace(hit),
                    });
                }
            }

            return {
                botIntersections: intersections,
                ray: {
                    origin: convertVector3(
                        result.ray.origin,
                        1 / defaultGridScale
                    ),
                    direction: convertVector3(result.ray.direction, 1),
                },
            };
        }
        return null;
    }

    private _findSimulationForPortalTag(
        simulation: Simulation,
        portalTag: string
    ): Simulation3D {
        return this.getSimulations().find(
            (sim) =>
                sim.simulation === simulation &&
                sim.portalTags.indexOf(portalTag) >= 0
        );
    }

    dragBot(
        pageSim: PlayerPageSimulation3D,
        miniSim: MiniSimulation3D,
        bot: Bot | BotTags
    ) {
        let dimension: string;
        if (isBot(bot)) {
            // Try to find the dimension that the bot is already in from the page and mini simulations.
            const pageBots = pageSim.findBotsById(bot.id);
            if (pageBots.length > 0) {
                dimension = pageSim.dimension;
            } else {
                const miniBots = miniSim.findBotsById(bot.id);
                if (miniBots.length > 0) {
                    dimension = miniSim.dimension;
                }
            }
        }

        // Default to the grid portal dimension
        if (!dimension) {
            dimension = pageSim.dimension;
        }

        this.interaction.dragBot(pageSim.simulation, bot, dimension);
    }

    playAudio(sim: Simulation, event: PlaySoundAction) {
        if (event.url === null) return;

        this.audio.playFromUrl(event.url, event.soundID).then(
            () => {
                let list = [] as BotAction[];
                enqueueAsyncResult(list, event, event.soundID, false);
                sim.helper.transaction(...list);
            },
            (err) => {
                let list = [] as BotAction[];
                enqueueAsyncError(list, event, err);
                sim.helper.transaction(...list);
            }
        );
    }

    bufferAudio(sim: Simulation, event: BufferSoundAction) {
        if (!hasValue(event.url)) return;

        this.audio.bufferFromUrl(event.url).then(
            () => {
                let list = [] as BotAction[];
                enqueueAsyncResult(list, event, null, false);
                sim.helper.transaction(...list);
            },
            (err) => {
                let list = [] as BotAction[];
                enqueueAsyncError(list, event, err);
                sim.helper.transaction(...list);
            }
        );
    }

    cancelAudio(sim: BrowserSimulation, event: CancelSoundAction) {
        this.audio.cancelSound(event.soundID);
        let list = [] as BotAction[];
        enqueueAsyncResult(list, event, null, false);
        sim.helper.transaction(...list);
    }

    resetCameras() {
        this.interaction.clearOperationsOfType(TweenCameraToOperation);
        this.interaction.cameraRigControllers.forEach((controller) => {
            if (controller.rig.name != 'miniGridPortal')
                controller.controls.reset();
        });
    }

    private async importAUX(sim: BrowserSimulation, event: ImportAUXAction) {
        try {
            const url = event.url;
            const stored = await appManager.loadAUX(url);
            if (isStoredVersion2(stored)) {
                await addStoredAuxV2ToSimulation(sim, stored);
            } else {
                const state = getBotsStateFromStoredAux(stored);
                await sim.helper.addState(state);
            }

            if (hasValue(event.taskId)) {
                sim.helper.transaction(asyncResult(event.taskId, null));
            }
        } catch (err) {
            if (hasValue(event.taskId)) {
                sim.helper.transaction(
                    asyncError(event.taskId, err.toString())
                );
            }
        }
    }

    /**
     * Render the current frame for the default browser mode.
     */
    protected renderBrowser() {
        this.renderer.setSize(
            this.mainViewport.width,
            this.mainViewport.height
        );

        if (!this.gameView.hasMap) {
            super.renderMainViewport(true);
        } else {
            this.renderMapViewport();
            // super.renderMainViewport(false);
            // this.renderer.clear();
            // this.renderMapToMainViewport();
        }

        //
        // [miniGridPortal scene]
        //
        if (!this.gameView.hasMiniMap) {
            this.renderMiniViewport();
        } else {
            this.renderMiniMapViewport();
        }

        if (this._screenshotTasks.length > 0) {
            this._capturePortalScreenshots();
        }
    }

    private async _capturePortalScreenshots() {
        const tasks = this._screenshotTasks.splice(
            0,
            this._screenshotTasks.length
        );
        const screenshot = await new Promise<Blob>((resolve, reject) => {
            try {
                this.renderer.domElement.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            } catch (err) {
                reject(err);
            }
        });

        const photo: Photo = {
            data: screenshot,
            height: this.renderer.domElement.height,
            width: this.renderer.domElement.width,
        };

        for (let task of tasks) {
            task.sim.helper.transaction(asyncResult(task.taskId, photo));
        }
    }

    /**
     * Renders the mini scene to the mini viewport.
     */
    protected renderMiniViewport() {
        this.miniCameraRig.mainCamera.updateMatrixWorld(true);

        // if (!this.gameView.hasMap) {
        this.renderer.clearDepth(); // Clear depth buffer so that miniGridPortal scene always appears above the main scene.
        // }
        this.miniSceneBackgroundUpdate();
        this.miniSceneHDRBackgroundUpdate();

        const defaultLighting = this.getMiniDefaultLighting();
        this._miniAmbientLight.visible = defaultLighting;
        this._miniDirectionalLight.visible = defaultLighting;

        this.renderer.setViewport(
            this.miniViewport.x,
            this.miniViewport.y,
            this.miniViewport.width,
            this.miniViewport.height
        );
        this.renderer.setScissor(
            this.miniViewport.x,
            this.miniViewport.y,
            this.miniViewport.width,
            this.miniViewport.height
        );

        this.renderer.setScissorTest(true);

        // Render the miniGridPortal scene with the miniGridPortal main camera.
        this.renderer.render(this.miniScene, this.miniCameraRig.mainCamera);
    }

    /**
     * Renders the map scene to the main viewport.
     */
    protected renderMapViewport() {
        this.mapScene.background = null;
        this.renderer.setClearColor('#000', 0);
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(
            this.mapViewport.x,
            this.mapViewport.y,
            this.mapViewport.width,
            this.mapViewport.height
        );

        this.renderer.clear();
        // this.renderer.clearDepth();

        // Render the map portal scene with the map portal main camera.
        this.renderer.render(this.mapScene, this.mapCameraRig.mainCamera);
    }

    /**
     * Renders the mini map scene to the mini map viewport.
     */
    protected renderMiniMapViewport() {
        this.miniMapScene.background = null;
        this.renderer.setClearColor('#000', 0);
        this.renderer.setViewport(
            this.miniMapViewport.x,
            this.miniMapViewport.y,
            this.miniMapViewport.width,
            this.miniMapViewport.height
        );
        this.renderer.setScissor(
            this.miniMapViewport.x,
            this.miniMapViewport.y,
            this.miniMapViewport.width,
            this.miniMapViewport.height
        );

        this.renderer.setScissorTest(true);
        this.renderer.clear();

        // Render the miniMapPortal scene with the miniMapPortal main camera.
        this.renderer.render(
            this.miniMapScene,
            this.miniMapCameraRig.mainCamera
        );
    }

    /**
     * Render the current frame for AR.
     */
    protected renderAR() {
        super.renderAR();
    }

    /**
     * Render the current frame for VR.
     */
    protected renderVR() {
        this.renderer.setScissorTest(false);
        super.renderVR();
        this.renderer.setScissorTest(false);
    }

    private miniSceneBackgroundUpdate() {
        let tagColor = this.getMiniPortalColor();

        if (tagColor) {
            this.miniScene.background = tagColor;
        } else {
            let sceneColor =
                this.mainScene.background instanceof Color
                    ? this.mainScene.background
                    : null;
            let backgroundColor = this.getBackground();
            let currentColor =
                sceneColor ??
                (backgroundColor instanceof Color
                    ? backgroundColor
                    : new Color(DEFAULT_SCENE_BACKGROUND_COLOR));
            let invColor: Color | Texture = currentColor.clone();
            invColor.offsetHSL(0, -0.02, -0.04);
            this.miniScene.background = invColor;
        }
    }

    private miniSceneHDRBackgroundUpdate() {
        const miniAddress = this.getMiniPortalHDRAddress();
        if (this._currentMiniHDRAddress === miniAddress) {
            return;
        }
        this._currentMiniHDRAddress = miniAddress;
        if (miniAddress) {
            this.loadEXRTextureIntoScene(miniAddress, this.miniScene);
        } else {
            this.miniScene.environment = null;
        }
    }

    protected setupRendering() {
        super.setupRendering();

        this.miniViewport = new Viewport('miniGridPortal', this.mainViewport);
        console.log('Set height initial value: ' + this.miniViewport.height);
        this.miniViewport.layer = 1;

        this.mapViewport = new Viewport(
            'mapPortal',
            null,
            this.gameView.gameView
        );
        this.mapViewport.layer = -1;

        this.miniMapViewport = new Viewport('miniMapPortal', this.mapViewport);
        console.log('Set height initial value: ' + this.miniMapViewport.height);
        this.miniMapViewport.layer = -1;
    }

    protected setupScenes() {
        super.setupScenes();

        //
        // [miniGridPortal scene]
        //
        this.setupMiniScene();
        this.setupMapScene();
        this.setupMiniMapScene();

        this.setupDelay = true;

        this.audio = new GameAudio();
    }

    protected setupMiniScene() {
        this.miniScene = new Scene();
        this.miniScene.autoUpdate = false;

        // miniGridPortal camera.
        this.miniCameraRig = createCameraRig(
            'miniGridPortal',
            'orthographic',
            this.miniScene,
            this.miniViewport
        );

        // miniGridPortal ambient light.
        const invAmbient = baseAuxAmbientLight();
        this.miniScene.add(invAmbient);
        this._miniAmbientLight = invAmbient;

        // miniGridPortal direction light.
        const invDirectional = baseAuxDirectionalLight();
        this.miniScene.add(invDirectional);
        this._miniDirectionalLight = invDirectional;
    }

    private _createGlobeMask() {
        return new Mesh(
            new SphereGeometry(EARTH_RADIUS, 40, 40),
            new MeshBasicMaterial({
                color: 'red',
                colorWrite: false,
                stencilWrite: false,
                depthWrite: true,
            })
        );
    }

    protected setupMapScene() {
        this.mapScene = new Scene();
        this.mapScene.autoUpdate = false;

        this._mapGlobeMask = this._createGlobeMask();
        this.mapScene.add(this._mapGlobeMask);

        // miniGridPortal camera.
        this.mapCameraRig = this._createMapCameraRig(
            'mapPortal',
            'perspective',
            this.mapScene,
            this.mapViewport,
            () => this.gameView.getMapView()
        );

        // miniGridPortal ambient light.
        this.mapAmbientLight = baseAuxAmbientLight();
        this.mapScene.add(this.mapAmbientLight);

        // miniGridPortal direction light.
        this.mapDirectionalLight = baseAuxDirectionalLight();
        this.mapScene.add(this.mapDirectionalLight);
    }

    protected setupMiniMapScene() {
        this.miniMapScene = new Scene();
        this.miniMapScene.autoUpdate = false;

        this._miniMapGlobeMask = this._createGlobeMask();
        this.miniMapScene.add(this._miniMapGlobeMask);

        // miniGridPortal camera.
        this.miniMapCameraRig = this._createMapCameraRig(
            'miniMapPortal',
            'perspective',
            this.miniMapScene,
            this.miniMapViewport,
            () => this.gameView.getMiniMapView()
        );

        // miniGridPortal ambient light.
        this.miniMapAmbientLight = baseAuxAmbientLight();
        this.miniMapScene.add(this.miniMapAmbientLight);

        // miniGridPortal direction light.
        this.miniMapDirectionalLight = baseAuxDirectionalLight();
        this.miniMapScene.add(this.miniMapDirectionalLight);
    }

    onWindowResize(width: number, height: number) {
        super.onWindowResize(width, height);

        this._updateMiniPortal();
        this.mapViewport.setSize(width, height);
    }

    private _updateMiniPortal() {
        this.miniPortalVisible = this.getMiniPortalVisible();

        if (this.miniPortalVisible === true) {
            this._showMiniPortal();
        } else {
            this._hideMiniPortal();
        }

        if (!this.miniPortalVisible && !this.miniMapPortalVisible) {
            return;
        }

        let configuredHeight: number = DEFAULT_MINI_PORTAL_HEIGHT;
        if (this.miniMapPortalVisible) {
            configuredHeight = this.getMiniMapPortalHeight();
        } else if (this.miniPortalVisible) {
            configuredHeight = this.getMiniPortalHeight();
        }

        if (this._miniPortalConfiguredHeight != configuredHeight) {
            this._miniPortalConfiguredHeight = configuredHeight;
            this._miniPortalHeight = configuredHeight;
        }

        this._miniPortalHeight = clamp(
            this._miniPortalHeight,
            MINI_PORTAL_MIN_PERCENT,
            MINI_PORTAL_MAX_PERCENT
        );

        let heightOffset: number = null;
        let widthPercent: number = null;
        if (this.miniMapPortalVisible) {
            heightOffset = this.getMiniMapPortalHeightPadding();
            widthPercent = this.getMiniMapPortalWidth();
        } else if (this.miniPortalVisible) {
            heightOffset = this.getMiniPortalHeightPadding();
            widthPercent = this.getMiniPortalWidth();
        }
        const hasCustomWidth = widthPercent !== null;
        widthPercent ??= MINI_PORTAL_DEFAULT_WIDTH;

        const mainViewportSize = this.mainViewport.getSize();
        const mainViewportWidth = mainViewportSize.x;
        const mainViewportHeight = mainViewportSize.y;

        if (
            !hasCustomWidth &&
            mainViewportWidth <= MINI_PORTAL_WIDTH_BREAKPOINT
        ) {
            heightOffset = mainViewportWidth * 0.05;
            widthPercent = MINI_PORTAL_SMALL_WIDTH;
        }
        this._miniPortalAvailableHeight = mainViewportHeight - heightOffset * 2;
        const miniPortalHeight =
            this._miniPortalHeight * this._miniPortalAvailableHeight;
        let miniPortalHeightPercent = miniPortalHeight / mainViewportHeight;

        // clamp the width to <= 700px
        const miniViewportWidth = widthPercent * mainViewportWidth;
        if (!hasCustomWidth && miniViewportWidth > this._miniPortalMaxWidth) {
            widthPercent = this._miniPortalMaxWidth / mainViewportWidth;
        } else if (miniViewportWidth > mainViewportWidth) {
            widthPercent = 1;
        }

        this.miniViewport.setScale(widthPercent, miniPortalHeightPercent);
        this.miniMapViewport.setScale(widthPercent, miniPortalHeightPercent);

        this.miniViewport.setOrigin(
            mainViewportWidth / 2 - this.miniViewport.getSize().x / 2,
            heightOffset
        );
        this.miniMapViewport.setOrigin(
            mainViewportWidth / 2 - this.miniMapViewport.getSize().x / 2,
            heightOffset
        );

        this._updateMiniPortalSlider();

        if (this.miniCameraRig) {
            this.overrideOrthographicViewportZoom(this.miniCameraRig);
            resizeCameraRig(this.miniCameraRig);
        }

        this.miniViewport.updateViewport();
        this.miniMapViewport.updateViewport();
    }

    /**
     * Updates the positioning of the resize indicators for the miniGridPortal.
     */
    private _updateMiniPortalSlider() {
        const height = this.mainViewport.height;
        // set the new slider's top position to the top of the miniGridPortal viewport
        let sliderTop =
            height -
            this.miniViewport.height -
            this.miniViewport.y -
            MINI_PORTAL_SLIDER_HALF_HEIGHT;
        (<HTMLElement>this.slider).style.top = sliderTop.toString() + 'px';

        let left = this.miniViewport.x - MINI_PORTAL_SLIDER_HALF_WIDTH;

        (<HTMLElement>this.slider).style.left = left.toString() + 'px';

        let right =
            this.miniViewport.x +
            this.miniViewport.width +
            MINI_PORTAL_SLIDER_HALF_WIDTH;

        let width = right - left;

        (<HTMLElement>this.slider).style.width = width.toString() + 'px';
    }

    private _showMiniPortal() {}

    private _hideMiniPortal() {
        this.miniViewport.setScale(null, 0);
    }

    private _hideMiniPortalsSlider() {
        (<HTMLElement>this.slider).style.display = 'none';
    }

    private _showMiniPortalsSlider() {
        (<HTMLElement>this.slider).style.display = 'block';
    }

    protected frameUpdate(time: number, xrFrame?: XRFrame) {
        super.frameUpdate(time, xrFrame);
        TWEEN.update(this.time.timeSinceStart * 1000);

        if (this.setupDelay) {
            this.onCenterCamera(this.miniCameraRig);
            this.setupDelay = false;
        }

        this._updateVisibility();
        this._updateMapPortalVisibility();
        this._updateDefaultZoomAndRotation();
        this._updateMiniPortalVisibility();
        this._updateMiniPortalControls();
        this._updateMiniPortalSliderVisibility();
        this._updateMainControls();
        this._updateCanvasTransparency();
        this._updateGridPortalValues();
        this._updateConfigBotValues();

        this._updateMapPortals();
    }

    private _updateVisibility() {
        const visible =
            this.getGridPortalVisible() ||
            this.getMiniPortalVisible() ||
            this.getMapPortalVisible();

        if (visible && this.gameView.container.style.display !== 'block') {
            this.gameView.container.style.display = 'block';

            // containerId doesn't match gameView.container (bad naming I know)
            if (this.gameView.containerId) {
                const gameContainer = document.getElementById(
                    this.gameView.containerId
                );
                if (gameContainer) {
                    gameContainer.style.display = 'block';
                }
            }

            // Hide all VM containers when the game view is visible
            const vmContainers = document.querySelectorAll(
                '.vm-iframe-container'
            );
            for (let container of vmContainers) {
                if (container instanceof HTMLElement) {
                    container.classList.add('game-view-visible');
                }
            }
        } else if (
            !visible &&
            this.gameView.container.style.display !== 'none'
        ) {
            this.gameView.container.style.display = 'none';
            // containerId doesn't match gameView.container (bad naming I know)
            if (this.gameView.containerId) {
                const gameContainer = document.getElementById(
                    this.gameView.containerId
                );
                if (gameContainer) {
                    gameContainer.style.display = 'none';
                }
            }

            // show all VM containers when the game view is visible
            const vmContainers = document.querySelectorAll(
                '.vm-iframe-container'
            );
            for (let container of vmContainers) {
                if (container instanceof HTMLElement) {
                    container.classList.remove('game-view-visible');
                }
            }
        }
    }

    private _updateMapPortals() {
        this._updateMapPortalVisibility();
        this._updateMapPortalBasemap();
        this._updateMiniMapPortalVisibility();
        this._updateMiniMapPortalBasemap();
        this._updateMapPortalKind();
        this._updateMiniMapPortalKind();
    }

    private _updateMapPortalBasemap() {
        const view = this.gameView.getMapView();
        if (view) {
            this.gameView.setBasemap(this.getMapPortalBasemap());
        }
    }

    private _updateMapPortalKind() {
        const view = this.gameView.getMapView();
        if (view) {
            const kind = this.getMapPortalKind();

            const viewingMode = kind === 'globe' ? 'global' : 'local';
            if (view.viewingMode !== viewingMode) {
                if (view.ready) {
                    const cameraProperties: __esri.CameraProperties = {
                        position: view.camera.position.toJSON(),
                        fov: view.camera.fov,
                        tilt: view.camera.tilt,
                        heading: view.camera.heading,
                    };
                    this._disableMapPortal();
                    this._setupMapPortal(cameraProperties);
                } else {
                    view.viewingMode = viewingMode;
                }
            }

            // update the globe mask visibility
            this._mapGlobeMask.visible = kind === 'globe';
        }
    }

    private _updateMiniMapPortalKind() {
        const view = this.gameView.getMiniMapView();
        if (view) {
            const kind = this.getMiniMapPortalKind();

            const viewingMode = kind === 'globe' ? 'global' : 'local';

            if (view.viewingMode !== viewingMode) {
                if (view.ready) {
                    const cameraProperties: __esri.CameraProperties = {
                        position: view.camera.position.toJSON(),
                        fov: view.camera.fov,
                        tilt: view.camera.tilt,
                        heading: view.camera.heading,
                    };
                    this._disableMiniMapPortal();
                    this._setupMiniMapPortal(cameraProperties);
                } else {
                    view.viewingMode = viewingMode;
                }
            }

            this._miniMapGlobeMask.visible = kind === 'globe';
        }
    }

    private _updateMapPortalVisibility() {
        const visible = this.getMapPortalVisible();
        if (this.mapPortalVisible == visible) {
            return;
        }

        this.mapPortalVisible = visible;
        if (visible) {
            this._setupMapPortal();
        } else {
            this._disableMapPortal();
        }
    }

    private _disableMapPortal() {
        for (let sim of this.mapSimulations) {
            sim.coordinateTransformer = null;
            sim.mapView = null;
        }
        this.gameView.disableMapView();
        this.mapViewport.layer = -1;
    }

    private async _setupMapPortal(camera?: __esri.CameraProperties) {
        await this.gameView.enableMapView(
            {
                setup: (context) => {
                    const view = this.gameView.getMapView();
                    const coordinateTransform =
                        this.gameView.getMapCoordinateTransformer();
                    for (let sim of this.mapSimulations) {
                        sim.coordinateTransformer = coordinateTransform;
                        sim.mapView = view;
                    }

                    this.mapViewport.layer = 0.5;
                },
                render: (context) => {
                    let contextCam = context.camera;
                    let camera = this.mapCameraRig.mainCamera;
                    camera.position.fromArray(contextCam.eye);
                    camera.up.fromArray(contextCam.up);
                    camera.lookAt(
                        new Vector3(
                            contextCam.center[0],
                            contextCam.center[1],
                            contextCam.center[2]
                        )
                    );
                    camera.projectionMatrix.fromArray(
                        contextCam.projectionMatrix
                    );
                    camera.projectionMatrixInverse
                        .copy(camera.projectionMatrix)
                        .invert();
                    camera.near = contextCam.near;
                    camera.far = contextCam.far;
                    camera.updateMatrixWorld(true);

                    this.mapDirectionalLight.position.fromArray(
                        context.sunLight.direction
                    );
                    this.mapDirectionalLight.intensity =
                        context.sunLight.diffuse.intensity;
                    this.mapDirectionalLight.color = new Color().fromArray(
                        context.sunLight.diffuse.color
                    );
                    this.mapDirectionalLight.updateMatrixWorld(true);

                    this.mapAmbientLight.intensity =
                        context.sunLight.ambient.intensity;
                    this.mapAmbientLight.color = new Color().fromArray(
                        context.sunLight.ambient.color
                    );
                    this.mapAmbientLight.updateMatrixWorld(true);
                },
                dispose: (context) => {},
            },
            camera
        );
    }

    private _updateMiniMapPortalVisibility() {
        const visible = this.getMiniMapPortalVisible();
        if (this.miniMapPortalVisible == visible) {
            return;
        }

        this.miniMapPortalVisible = visible;
        if (visible) {
            this._setupMiniMapPortal();
        } else {
            this._disableMiniMapPortal();
        }
    }

    private _disableMiniMapPortal() {
        for (let sim of this.miniMapSimulations) {
            sim.coordinateTransformer = null;
            sim.mapView = null;
        }
        this.gameView.disableMiniMapView();
        this.miniMapViewport.layer = -1;
    }

    private _setupMiniMapPortal(camera?: __esri.CameraProperties) {
        this.miniMapViewport.setScale(null, 0);
        this.gameView.enableMiniMapView(
            {
                setup: (context) => {
                    const view = this.gameView.getMiniMapView();
                    const coordinateTransform =
                        this.gameView.getMiniMapCoordinateTransformer();
                    for (let sim of this.miniMapSimulations) {
                        sim.coordinateTransformer = coordinateTransform;
                        sim.mapView = view;
                    }

                    this.miniMapViewport.layer = 1.5;
                    this.miniMapViewport.targetElement =
                        this.gameView.getMiniMapViewportTarget();
                },
                render: (context) => {
                    let contextCam = context.camera;
                    let camera = this.miniMapCameraRig.mainCamera;
                    camera.position.fromArray(contextCam.eye);
                    camera.up.fromArray(contextCam.up);
                    camera.lookAt(
                        new Vector3(
                            contextCam.center[0],
                            contextCam.center[1],
                            contextCam.center[2]
                        )
                    );
                    camera.projectionMatrix.fromArray(
                        contextCam.projectionMatrix
                    );
                    camera.projectionMatrixInverse
                        .copy(camera.projectionMatrix)
                        .invert();
                    camera.near = contextCam.near;
                    camera.far = contextCam.far;
                    camera.updateMatrixWorld(true);

                    this.miniMapDirectionalLight.position.fromArray(
                        context.sunLight.direction
                    );
                    this.miniMapDirectionalLight.intensity =
                        context.sunLight.diffuse.intensity;
                    this.miniMapDirectionalLight.color = new Color().fromArray(
                        context.sunLight.diffuse.color
                    );
                    this.miniMapDirectionalLight.updateMatrixWorld(true);

                    this.miniMapAmbientLight.intensity =
                        context.sunLight.ambient.intensity;
                    this.miniMapAmbientLight.color = new Color().fromArray(
                        context.sunLight.ambient.color
                    );
                    this.miniMapAmbientLight.updateMatrixWorld(true);
                    // this.renderMapViewport();
                },
                dispose: (context) => {},
            },
            camera
        );
    }

    private _updateMiniMapPortalBasemap() {
        const view = this.gameView.getMiniMapView();
        if (view) {
            this.gameView.setMiniMapBasemap(this.getMiniMapPortalBasemap());
        }
    }

    private _updateGridPortalValues() {
        const renderingSize = new Vector2();
        this.renderer.getSize(renderingSize);

        for (let [id, sim] of appManager.simulationManager.simulations) {
            const portalConfig = getPortalConfigBot(sim, 'gridPortal');
            if (portalConfig) {
                let update = {} as BotTags;
                let hasUpdate = false;
                if (
                    portalConfig.tags['pixelWidth'] !== renderingSize.x ||
                    portalConfig.tags['pixelHeight'] !== renderingSize.y
                ) {
                    update.pixelWidth = renderingSize.x;
                    update.pixelHeight = renderingSize.y;
                    hasUpdate = true;
                }
                const pagePos = this.getInput().getMousePagePos();
                if (
                    !(this.interaction as PlayerInteractionManager)
                        .disablePlayerBotTags &&
                    pagePos &&
                    (portalConfig.tags['pointerPixelX'] !== pagePos.x ||
                        portalConfig.tags['pointerPixelY'] !== pagePos.y)
                ) {
                    update.pointerPixelX = pagePos.x;
                    update.pointerPixelY = pagePos.y;
                    update.pointerPixel = formatBotVector(pagePos);
                    hasUpdate = true;
                }

                if (hasUpdate) {
                    sim.helper.updateBot(portalConfig, {
                        tags: update,
                    });
                }
            }
        }
    }

    private _updateConfigBotValues() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        for (let [id, sim] of appManager.simulationManager.simulations) {
            const config = sim.helper.userBot;
            if (config) {
                let update = {} as BotTags;
                let hasUpdate = false;
                if (config.tags['defaultPixelRatio'] !== devicePixelRatio) {
                    update.defaultPixelRatio = devicePixelRatio;
                    hasUpdate = true;
                }

                if (hasUpdate) {
                    sim.helper.updateBot(config, {
                        tags: update,
                    });
                }
            }
        }
    }

    private _updateCanvasTransparency() {
        if (
            this.disableCanvasTransparency !==
            this.getDisableCanvasTransparency()
        ) {
            this.disableCanvasTransparency =
                this.getDisableCanvasTransparency();
            if (this.disableCanvasTransparency) {
                this.renderer.domElement.style.backgroundColor = '#000';
            } else {
                this.renderer.domElement.style.backgroundColor = null;
            }
        }
    }

    private _updateMainControls() {
        const mainControls = this.interaction.cameraRigControllers.find(
            (c) => c.rig.name === this.mainCameraRig.name
        );

        if (mainControls) {
            mainControls.controls.enablePan = this.getPannable();
            mainControls.controls.enableRotate = this.getRotatable();
            mainControls.controls.enableZoom = this.getZoomable();

            if (mainControls.rig.mainCamera instanceof PerspectiveCamera) {
                mainControls.controls.minDistance =
                    this.getPerspectiveZoomMin();
                mainControls.controls.maxDistance =
                    this.getPerspectiveZoomMax();
                mainControls.controls.minZoom = Orthographic_MinZoom;
                mainControls.controls.maxZoom = Orthographic_MaxZoom;
            } else {
                mainControls.controls.minDistance = Perspective_MinZoom;
                mainControls.controls.maxDistance = Perspective_MaxZoom;
                mainControls.controls.minZoom = this.getZoomMin();
                mainControls.controls.maxZoom = this.getZoomMax();
            }

            mainControls.controls.minPanX = this.getPanMinX();
            mainControls.controls.maxPanX = this.getPanMaxX();

            mainControls.controls.minPanY = this.getPanMinY();

            if (this.getPanMinY() != null) {
                mainControls.controls.minPanY = this.getPanMinY() * -1;
            } else {
                mainControls.controls.minPanY = null;
            }

            if (this.getPanMaxY() != null) {
                mainControls.controls.maxPanY = this.getPanMaxY() * -1;
            } else {
                mainControls.controls.maxPanY = null;
            }

            const showFocus = this.getPlayerShowFocusPoint();
            if (showFocus && !this.xrSession) {
                if (!this.mainFocusPoint) {
                    this.mainFocusPoint = createFocusPointSphere();
                    this.mainScene.add(this.mainFocusPoint);
                }
                this.mainFocusPoint.visible = true;
                // TODO: Support focus point in VR
                let targetWorld: Vector3 = mainControls.controls.target.clone();
                mainControls.rig.cameraParent.localToWorld(targetWorld);
                this.mainFocusPoint.position.copy(targetWorld);
                this.mainFocusPoint.updateMatrixWorld(true);
            } else {
                if (this.mainFocusPoint) {
                    this.mainFocusPoint.visible = false;
                    this.mainFocusPoint.updateMatrixWorld(true);
                }
            }
        }
    }

    private _updateMiniPortalVisibility() {
        if (
            this.miniPortalVisible != this.getMiniPortalVisible() ||
            this._miniPortalConfiguredHeight != this.getMiniPortalHeight()
        ) {
            this._updateMiniPortal();
        }
    }

    private _hasResizableMiniPortal() {
        const hasResizableMiniPortal =
            this.getMiniPortalResizable() && this.miniPortalVisible;
        const hasResizableMiniMapPortal =
            this.getMiniMapPortalResizable() && this.miniMapPortalVisible;
        return hasResizableMiniPortal || hasResizableMiniMapPortal;
    }

    private _updateMiniPortalSliderVisibility() {
        if (this._hasResizableMiniPortal()) {
            // make sure dragging areas are active
            this._showMiniPortalsSlider();
        } else {
            // remove dragging areas
            this._hideMiniPortalsSlider();
        }
    }

    private _updateMiniPortalControls() {
        if (this.miniPortalControls != null) {
            this.miniPortalControls.controls.enablePan =
                this.getMiniPortalPannable();
            this.miniPortalControls.controls.enableRotate =
                this.getMiniPortalRotatable();
            this.miniPortalControls.controls.enableZoom =
                this.getMiniPortalZoomable();

            this.miniPortalControls.controls.minPanX =
                this.getMiniPortalPanMinX();
            this.miniPortalControls.controls.maxPanX =
                this.getMiniPortalPanMaxX();

            //this.invController.controls.minPanY = this.getPanMinY();
            if (this.getMiniPortalPanMinY() != null) {
                this.miniPortalControls.controls.minPanY =
                    this.getMiniPortalPanMinY() * -1;
            } else {
                this.miniPortalControls.controls.minPanY = null;
            }

            if (this.getMiniPortalPanMaxY() != null) {
                this.miniPortalControls.controls.maxPanY =
                    this.getMiniPortalPanMaxY() * -1;
            } else {
                this.miniPortalControls.controls.maxPanY = null;
            }

            const showFocus = this.getMiniPortalShowFocusPoint();
            if (showFocus && !this.xrSession) {
                if (!this.miniPortalFocusPoint) {
                    this.miniPortalFocusPoint = createFocusPointSphere();
                    this.miniScene.add(this.miniPortalFocusPoint);
                }
                this.miniPortalFocusPoint.visible = true;
                let targetWorld: Vector3 =
                    this.miniPortalControls.controls.target.clone();
                this.miniPortalControls.rig.cameraParent.localToWorld(
                    targetWorld
                );
                this.miniPortalFocusPoint.position.copy(targetWorld);
                this.miniPortalFocusPoint.updateMatrixWorld(true);
            } else {
                if (this.miniPortalFocusPoint) {
                    this.miniPortalFocusPoint.visible = false;
                    this.miniPortalFocusPoint.updateMatrixWorld(true);
                }
            }
        }
    }

    private _updateDefaultZoomAndRotation() {
        if (
            this.defaultPlayerZoom === null &&
            this.defaultPlayerRotationX === null &&
            this.defaultPlayerRotationY === null
        ) {
            const zoomNum = this.getPlayerZoom();
            const rotX = this.getPlayerRotationX();
            const rotY = this.getPlayerRotationY();

            if (
                (zoomNum != undefined && zoomNum != this.defaultPlayerZoom) ||
                (rotX != undefined && rotX != this.defaultPlayerRotationX) ||
                (rotY != undefined && rotY != this.defaultPlayerRotationY)
            ) {
                this._setCameraRotationAndZoom(
                    rotX,
                    rotY,
                    zoomNum,
                    this.mainCameraRig
                );
            }

            this.defaultPlayerZoom = zoomNum;
            this.defaultPlayerRotationX = rotX;
            this.defaultPlayerRotationY = rotY;
        }

        if (
            this.defaultMiniZoom === null &&
            this.defaultMiniRotationX === null &&
            this.defaultMiniRotationY === null
        ) {
            const zoomNum = this.getMiniPortalZoom();
            const rotX = this.getMiniPortalRotationX();
            const rotY = this.getMiniPortalRotationY();

            if (
                (zoomNum != undefined && zoomNum != this.defaultMiniZoom) ||
                (rotX != undefined && rotX != this.defaultMiniRotationX) ||
                (rotY != undefined && rotY != this.defaultMiniRotationY)
            ) {
                this._setCameraRotationAndZoom(
                    rotX,
                    rotY,
                    zoomNum,
                    this.miniCameraRig
                );
            }

            this.defaultMiniZoom = zoomNum;
            this.defaultMiniRotationX = rotX;
            this.defaultMiniRotationY = rotY;
        }
    }

    private _setCameraRotationAndZoom(
        rotX: number,
        rotY: number,
        zoomNum: number,
        rig: CameraRig
    ) {
        if (rotX != null && rotY != null) {
            this.setCameraToPosition(
                rig,
                new Vector3(0, 0, 0),
                zoomNum,

                // The player rotation X and Y values
                new Vector2(rotX, rotY)
            );
        } else {
            this.setCameraToPosition(rig, new Vector3(0, 0, 0), zoomNum);
        }
    }

    protected renderCursor() {
        const pagePos = this.getInput().getMousePagePos();
        const miniViewport = this.miniViewport;
        const miniMapViewport = this.miniMapViewport;
        const isMiniPortal = Input.pagePositionOnViewport(
            pagePos,
            miniViewport,
            this.getViewports()
        );
        const isMiniMapPortal =
            !isMiniPortal &&
            Input.pagePositionOnViewport(
                pagePos,
                miniMapViewport,
                this.getViewports()
            );
        this.backgroundCursor = isMiniPortal
            ? this.getMiniPortalCursor()
            : isMiniMapPortal
            ? this.getMiniMapPortalCursor()
            : this.getCursor();

        super.renderCursor();
    }

    protected updateInteraction() {
        super.updateInteraction();
        this._updatePixelRatio();
        this._updateMiniPortalSize();
    }

    private _updatePixelRatio() {
        const targetPixelRatio =
            this.getPixelRatio() ?? (window.devicePixelRatio || 1);
        if (hasValue(targetPixelRatio)) {
            this.setPixelRatio(targetPixelRatio);
        }
    }

    private _updateMiniPortalSize() {
        if (!this._hasResizableMiniPortal()) {
            return;
        }

        const clientPos = this.input.getMouseClientPos();
        if (this.input.getMouseButtonDown(MouseButtonId.Left)) {
            const overSlider = Input.eventIsDirectlyOverElement(
                clientPos,
                this.slider
            );

            if (overSlider) {
                this._resizingMiniPortal = true;
                this._startResizeClientPos = clientPos;
                this._currentResizeClientPos = clientPos;
                this._startMiniPortalHeight = this._miniPortalHeight;

                if (
                    this.miniCameraRig.mainCamera instanceof OrthographicCamera
                ) {
                    this.startAspect =
                        this.miniCameraRig.viewport.width /
                        this.miniCameraRig.viewport.height;
                    this.startZoom = this.miniCameraRig.mainCamera.zoom;
                    this.startOffset = this.panValueCurr;
                }
            }
        }

        if (this.input.getMouseButtonUp(0)) {
            this._resizingMiniPortal = false;
        }

        if (!this._resizingMiniPortal) {
            return;
        }

        const positionOffset = clientPos
            .clone()
            .sub(this._startResizeClientPos);

        const deltaHeight = -positionOffset.y;
        const deltaHeightPercent =
            deltaHeight / this._miniPortalAvailableHeight;

        this._miniPortalHeight = clamp(
            this._startMiniPortalHeight + deltaHeightPercent,
            MINI_PORTAL_MIN_PERCENT,
            MINI_PORTAL_MAX_PERCENT
        );

        this._updateMiniPortal();

        // Pan the camera so that the bots stay in the same position
        // even though the center of the viewport is changing.
        const panDelta = clientPos.clone().sub(this._currentResizeClientPos);
        this.miniPortalControls.controls.pan(0, -panDelta.y / 2);

        this._currentResizeClientPos = clientPos;
    }

    /**
     * This is a hacky function that gets us a more pleasent orthographic zoom level
     * as we change the aspect ratio of the viewport that has an orthographic camera.
     */
    private overrideOrthographicViewportZoom(cameraRig: CameraRig) {
        if (cameraRig.mainCamera instanceof OrthographicCamera) {
            const aspect = cameraRig.viewport.width / cameraRig.viewport.height;

            if (this._resizingMiniPortal) {
                let zoomC = this.startZoom / this.startAspect;
                const newZoom =
                    this.startZoom - (this.startZoom - aspect * zoomC);
                cameraRig.mainCamera.zoom = newZoom;
            }
        }

        if (!this.setupDelay) {
            if (this.miniPortalControls == null) {
                this.miniPortalControls =
                    this.interaction.cameraRigControllers.find(
                        (c) => c.rig.name === cameraRig.name
                    );
            }
        }
    }

    /**
     * Creates a camera rig that is specialized for ArcGIS camera controls.
     * @param name The name of the camera rig.
     * @param type The type of the camera.
     * @param scene The scene the camera should be added to.
     * @param viewport The viewport that the camera rig uses.
     * @returns
     */
    private _createMapCameraRig(
        name: string,
        type: CameraType,
        scene: Scene,
        viewport: Viewport,
        getMapView: () => __esri.SceneView
    ): CameraRig {
        const rig = createCameraRig(name, type, scene, viewport);

        let currentOperations = [] as AbortController[];

        rig.cancelFocus = () => {
            let ops = currentOperations;
            currentOperations = [];
            for (let op of ops) {
                op.abort();
            }
        };
        rig.focusOnPosition = (position, options) => {
            const mapView = getMapView();
            if (mapView && mapView.ready) {
                const instant = options.duration <= 0;
                let lon: number;
                let lat: number;
                if (position.type === 'world') {
                    const [newLon, newLat] =
                        ExternalRenderers.fromRenderCoordinates(
                            mapView,
                            [
                                position.position.x,
                                position.position.y,
                                position.position.z,
                            ],
                            0,
                            [0, 0, 0],
                            0,
                            SpatialReference.WGS84,
                            1
                        );
                    lon = newLon;
                    lat = newLat;
                } else {
                    lon = position.position.x;
                    lat = position.position.y;
                }

                let target: any = {
                    center: [lon, lat],
                };

                if (hasValue(options.zoom)) {
                    target.scale = options.zoom;
                }

                const controller = new AbortController();
                currentOperations.push(controller);

                let goToOptions: any = {
                    animate: !instant,
                    signal: controller.signal,
                };

                if (hasValue(options.duration)) {
                    goToOptions.duration = options.duration * 1000;
                }

                if (hasValue(options.easing)) {
                    goToOptions.easing = esriEasing(
                        getDefaultEasing(options.easing)
                    );
                }

                if (hasValue(options.rotation)) {
                    if (hasValue(options.rotation.x)) {
                        target.tilt = ThreeMath.radToDeg(options.rotation.x);
                    }
                    if (hasValue(options.rotation.y)) {
                        target.heading = -ThreeMath.radToDeg(
                            options.rotation.y
                        );
                    }
                }

                return mapView.goTo(target, goToOptions);
            }
        };

        return rig;
    }
}
function createFocusPointSphere(): Mesh {
    return createSphere(new Vector3(), 0x4ebdbf, 0.05);
}

function esriEasing(easing: Easing): string {
    if (easing.type === 'linear') {
        return 'linear';
    } else if (easing.type === 'cubic') {
        if (easing.mode === 'in') {
            return 'in-cubic';
        } else if (easing.mode === 'out') {
            return 'out-cubic';
        } else if (easing.mode === 'inout') {
            return 'in-out-cubic';
        }
    } else if (easing.type === 'exponential') {
        if (easing.mode === 'in') {
            return 'in-expo';
        } else if (easing.mode === 'out') {
            return 'out-expo';
        } else if (easing.mode === 'inout') {
            return 'in-out-expo';
        }
    }

    return null;
}

function convertVector3(vector: Vector3, scale: number): string {
    return `${VECTOR_TAG_PREFIX}${vector.x * scale},${vector.y * scale},${
        vector.z * scale
    }`;
}

function convertVector2(vector: Vector2 | Vector3): string {
    return `${VECTOR_TAG_PREFIX}${vector.x},${vector.y}`;
}
