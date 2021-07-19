import { Game } from '../../shared/scene/Game';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import {
    CameraRig,
    CameraType,
    createCameraRig,
    resizeCameraRig,
} from '../../shared/scene/CameraRigFactory';
import {
    Scene,
    Color,
    Texture,
    OrthographicCamera,
    Vector3,
    Vector2,
    Mesh,
    WebGLRenderer,
    sRGBEncoding,
    DirectionalLight,
    AmbientLight,
} from '@casual-simulation/three';
import { PlayerPageSimulation3D } from './PlayerPageSimulation3D';
import { MiniSimulation3D } from './MiniSimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first } from 'rxjs/operators';
import { flatMap, uniq } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import {
    BrowserSimulation,
    getPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    clamp,
    DEFAULT_MINI_PORTAL_VISIBLE,
    DEFAULT_PORTAL_SHOW_FOCUS_POINT,
    DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY,
    BufferSoundAction,
    hasValue,
    BotAction,
    enqueueAsyncResult,
    enqueueAsyncError,
    PlaySoundAction,
    CancelSoundAction,
    Bot,
    BotTags,
    isBot,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    getPortalConfigBotID,
    asyncResult,
    BotCursorType,
    getPortalTag,
    DEFAULT_MAP_PORTAL_VISIBLE,
    DEFAULT_MAP_PORTAL_BASEMAP,
    Easing,
    getEasing,
    getDefaultEasing,
} from '@casual-simulation/aux-common';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    createSphere,
} from '../../shared/scene/SceneUtils';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import { CameraRigControls } from '../../shared/interaction/CameraRigControls';
import { AuxBotVisualizer } from '../../shared/scene/AuxBotVisualizer';
import {
    getBotsStateFromStoredAux,
    Simulation,
} from '@casual-simulation/aux-vm';
import { GameAudio } from '../../shared/scene/GameAudio';
import TWEEN from '@tweenjs/tween.js';
import { MathUtils as ThreeMath } from '@casual-simulation/three';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import { Input, MouseButtonId } from '../../shared/scene/Input';
import { MapSimulation3D } from './MapSimulation3D';
import { CoordinateSystem } from '../../shared/scene/CoordinateSystem';
import { ExternalRenderers, SpatialReference } from '../MapUtils';

const MINI_PORTAL_SLIDER_HALF_HEIGHT = 36 / 2;
const MINI_PORTAL_SLIDER_HALF_WIDTH = 30 / 2;

const MINI_PORTAL_MAX_PERCENT = 1;
const MINI_PORTAL_MIN_PERCENT = 0.1;

const MINI_PORTAL_WIDTH_BREAKPOINT = 700;
/**
 * The default width percentage of the mini portal.
 */
const MINI_PORTAL_DEFAULT_WIDTH = 0.8;

/**
 * The default width percentage that the mini portal should use on small devices (< breakpoint).
 */
const MINI_PORTAL_SMALL_WIDTH = 0.9;

/**
 * The default padding needed for the available height padding.
 */
const MINI_PORTAL_DEFAULT_HEIGHT_PADDING = 40;

export class PlayerGame extends Game {
    gameView: PlayerGameView;

    playerSimulations: PlayerPageSimulation3D[] = [];
    miniSimulations: MiniSimulation3D[] = [];
    mapSimulations: MapSimulation3D[] = [];
    miniCameraRig: CameraRig = null;
    miniViewport: Viewport = null;
    mapViewport: Viewport = null;
    mapCameraRig: CameraRig = null;
    showMiniPortalCameraRigHome: boolean = false;
    disableCanvasTransparency: boolean = DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY;

    startZoom: number;
    startAspect: number;

    private miniScene: Scene;
    private mapScene: Scene;

    // /**
    //  * A scene that is used to allow the main scene to render
    //  * without drawing anything to the screen
    //  */
    // private emptyScene: Scene;

    private mapRenderer: WebGLRenderer;
    private mapDirectionalLight: DirectionalLight;
    private mapAmbientLight: AmbientLight;

    private mapPortalVisible: boolean = DEFAULT_MAP_PORTAL_VISIBLE;

    private _slider: HTMLElement;
    private _resizingMiniPortal: boolean = false;

    /**
     * The mouse position that the mini portal resize operation started at.
     * When resizing, we compare this value against the final value to determine how much larger/smaller the mini portal should be.
     */
    private _startResizeClientPos: Vector2 = null;
    private _currentResizeClientPos: Vector2 = null;
    private _startMiniPortalHeight: number;

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
     * The height that was last configured for the mini portal. This can be set directly by the user.
     * Represented as a percentage of the available height that the portal can take.
     */
    private _miniPortalConfiguredHeight: number;

    /**
     * The current height of the mini portal represented as a percentage of
     * the available height that the portal can take.
     * This can be manipulated by the user via resizing the portal.
     */
    private _miniPortalHeight: number;

    /**
     * The available height that can be used by the mini portal in px.
     */
    private _miniPortalAvailableHeight: number;

    /**
     * The maximum width of the mini portal in px.
     */
    private _miniPortalMaxWidth: number = 700;

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

    getRotatable(): boolean {
        return this._getSimulationValue(this.playerSimulations, 'rotatable');
    }

    getCursor(): BotCursorType {
        return this._getSimulationValue(this.playerSimulations, 'cursor');
    }

    getMiniPortalVisible(): boolean {
        return this._getSimulationValue(
            this.miniSimulations,
            'hasDimension',
            DEFAULT_MINI_PORTAL_VISIBLE
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

    getMapPortalVisible(): boolean {
        return this._getSimulationValue(
            this.mapSimulations,
            'hasDimension',
            DEFAULT_MAP_PORTAL_VISIBLE
        );
    }

    getMapPortalBasemap(): string {
        return this._getSimulationValue(
            this.mapSimulations,
            'basemap',
            DEFAULT_MAP_PORTAL_BASEMAP
        );
    }

    private _getSimulationValue<T, K extends keyof T>(
        simulations: T[],
        name: K,
        defaultValue: T[K] = null
    ): T[K] {
        for (let i = 0; i < simulations.length; i++) {
            const sim = simulations[i];
            if (sim[name] !== null) {
                return sim[name];
            }
        }

        return defaultValue;
    }

    getViewports(): Viewport[] {
        return [this.mainViewport, this.miniViewport, this.mapViewport];
    }
    getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig, this.miniCameraRig, this.mapCameraRig];
    }
    getSimulations(): Simulation3D[] {
        return [
            ...this.playerSimulations,
            ...this.miniSimulations,
            ...this.mapSimulations,
        ];
        // return [...this.playerSimulations];
        // return [...this.miniSimulations];
    }
    getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.gameView.$refs.miniPortal, this.slider];
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
    getMapPortalCameraRig(): CameraRig {
        return this.mapCameraRig;
    }
    findAllBotsById(id: string): AuxBotVisualizer[] {
        return [
            ...flatMap(this.playerSimulations, (s) => s.findBotsById(id)),
            ...flatMap(this.miniSimulations, (s) => s.findBotsById(id)),
            ...flatMap(this.mapSimulations, (s) => s.findBotsById(id)),
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
     * Find MiniPortal Simulation 3D object that is displaying for the given Simulation.
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

    dispose(): void {
        super.dispose();

        this.removeSidebarItem('debug_mode');
        this.removeSidebarGroup('simulations');
    }

    protected async onBeforeSetupComplete() {
        this.subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(
                    mergeMap(
                        (sim) =>
                            sim.connection.syncStateChanged.pipe(
                                first((sync) => sync)
                            ),
                        (sim, sync) => sim
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
        const playerSim3D = new PlayerPageSimulation3D(this, sim);
        playerSim3D.init();
        playerSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        playerSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        playerSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        // this.subs.push(
        //     // playerSim3D.simulationContext.itemsUpdated.subscribe(() => {
        //     //     this.onSimsUpdated();
        //     // })
        //     // playerSim3D.menuContext.itemsUpdated.subscribe(() => {
        //     //     this.onMenuUpdated();
        //     // })
        // );

        this.playerSimulations.push(playerSim3D);
        this.mainScene.add(playerSim3D);

        //
        // Create mini portal Simulation
        //
        const miniPortalSim3D = new MiniSimulation3D(this, sim);
        miniPortalSim3D.init();
        miniPortalSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        miniPortalSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        miniPortalSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.miniSimulations.push(miniPortalSim3D);
        this.miniScene.add(miniPortalSim3D);

        const mapPortalSim3D = new MapSimulation3D(this, sim);
        mapPortalSim3D.coordinateTransformer = this.gameView.getMapCoordinateTransformer();
        mapPortalSim3D.mapView = this.gameView.getMapView();
        mapPortalSim3D.targetCoordinateSystem = CoordinateSystem.Z_UP;
        mapPortalSim3D.init();
        mapPortalSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        mapPortalSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        mapPortalSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.mapSimulations.push(mapPortalSim3D);
        this.mapScene.add(mapPortalSim3D);

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe((e) => {
                if (e.type === 'go_to_dimension') {
                    this.resetCameras();
                    playerSim3D.simulation.helper.updateBot(
                        playerSim3D.simulation.helper.userBot,
                        {
                            tags: {
                                pagePortal: e.dimension,
                            },
                        }
                    );
                } else if (e.type === 'import_aux') {
                    this.importAUX(sim, e.url);
                } else if (e.type === 'play_sound') {
                    this.playAudio(sim, e);
                } else if (e.type === 'buffer_sound') {
                    this.bufferAudio(sim, e);
                } else if (e.type === 'cancel_sound') {
                    this.cancelAudio(sim, e);
                } else if (e.type === 'enable_ar') {
                    if (e.enabled) {
                        this.startAR();
                    } else {
                        this.stopAR();
                    }
                } else if (e.type === 'enable_vr') {
                    if (e.enabled) {
                        this.startVR();
                    } else {
                        this.stopVR();
                    }
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
                            : targetPortal === 'miniPortal'
                            ? miniPortalSim3D
                            : playerSim3D;

                    let convertedPosition = new Vector3();

                    if (sim.coordinateTransformer) {
                        const matrix = sim.coordinateTransformer({
                            x: e.position.x,
                            y: e.position.y,
                            z: 0,
                        });
                        convertedPosition.setFromMatrixPosition(matrix);
                    } else {
                        const gridScale = sim.getDefaultGridScale();
                        convertedPosition.set(
                            e.position.x * gridScale,
                            0,
                            e.position.y * -gridScale
                        );
                    }

                    const cameraRig = sim.getMainCameraRig();

                    this.tweenCameraToPosition(
                        cameraRig,
                        convertedPosition,
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
                        this.startPOV(e.center);
                    } else {
                        this.stopPOV();
                    }
                }
            })
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

        // Default to the page portal dimension
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

    private simulationRemoved(sim: BrowserSimulation) {
        //
        // Remove Player Simulation
        //
        const playerSimIndex = this.playerSimulations.findIndex(
            (s) => s.simulation.id === sim.id
        );
        if (playerSimIndex >= 0) {
            const removed = this.playerSimulations.splice(playerSimIndex, 1);
            removed.forEach((s) => {
                s.onBotAdded.removeListener(this.onBotAdded.invoke);
                s.onBotRemoved.removeListener(this.onBotRemoved.invoke);
                s.onBotUpdated.removeListener(this.onBotUpdated.invoke);
                s.unsubscribe();
                this.mainScene.remove(s);
            });
        }

        //
        // Remove mini portal Simulation
        //
        const invSimIndex = this.miniSimulations.findIndex(
            (s) => s.simulation.id == sim.id
        );

        if (invSimIndex >= 0) {
            const removed = this.miniSimulations.splice(invSimIndex, 1);
            removed.forEach((s) => {
                s.onBotAdded.removeListener(this.onBotAdded.invoke);
                s.onBotRemoved.removeListener(this.onBotRemoved.invoke);
                s.onBotUpdated.removeListener(this.onBotUpdated.invoke);
                s.unsubscribe();
                this.miniScene.remove(s);
            });
        }
    }

    resetCameras() {
        this.interaction.clearOperationsOfType(TweenCameraToOperation);
        this.interaction.cameraRigControllers.forEach((controller) => {
            if (controller.rig.name != 'miniPortal')
                controller.controls.reset();
        });
    }

    private async importAUX(sim: BrowserSimulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = getBotsStateFromStoredAux(stored);
        await sim.helper.addState(state);
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
        // [mini portal scene]
        //
        this.renderMiniViewport();
    }

    /**
     * Renders the mini scene to the mini viewport.
     */
    protected renderMiniViewport() {
        this.miniCameraRig.mainCamera.updateMatrixWorld(true);

        // if (!this.gameView.hasMap) {
        this.renderer.clearDepth(); // Clear depth buffer so that mini portal scene always appears above the main scene.
        // }
        this.miniSceneBackgroundUpdate();

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

        // Render the mini portal scene with the mini portal main camera.
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
        // this.mapRenderer
        this.renderer.render(this.mapScene, this.mapCameraRig.mainCamera);
    }

    /**
     * Render the current frame for XR (AR mode).
     */
    protected renderXR() {
        super.renderXR();
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

    protected setupRendering() {
        super.setupRendering();

        this.miniViewport = new Viewport('miniPortal', this.mainViewport);
        console.log('Set height initial value: ' + this.miniViewport.height);
        this.miniViewport.layer = 1;

        this.mapViewport = new Viewport(
            'mapPortal',
            null,
            this.gameView.gameView
        );
        this.mapViewport.layer = -1;
    }

    protected setupScenes() {
        super.setupScenes();

        //
        // [mini portal scene]
        //
        this.setupMiniScene();
        this.setupMapScene();

        this.setupDelay = true;

        this.audio = new GameAudio();
    }

    protected setupMiniScene() {
        this.miniScene = new Scene();
        this.miniScene.autoUpdate = false;

        // mini portal camera.
        this.miniCameraRig = createCameraRig(
            'miniPortal',
            'orthographic',
            this.miniScene,
            this.miniViewport
        );

        // mini portal ambient light.
        const invAmbient = baseAuxAmbientLight();
        this.miniScene.add(invAmbient);

        // mini portal direction light.
        const invDirectional = baseAuxDirectionalLight();
        this.miniScene.add(invDirectional);
    }

    protected setupMapScene() {
        this.mapScene = new Scene();
        this.mapScene.autoUpdate = false;

        // mini portal camera.
        this.mapCameraRig = this._createMapCameraRig(
            'mapPortal',
            'perspective',
            this.mapScene,
            this.mapViewport
        );

        // mini portal ambient light.
        this.mapAmbientLight = baseAuxAmbientLight();
        this.mapScene.add(this.mapAmbientLight);

        // mini portal direction light.
        this.mapDirectionalLight = baseAuxDirectionalLight();
        this.mapScene.add(this.mapDirectionalLight);
    }

    onWindowResize(width: number, height: number) {
        super.onWindowResize(width, height);

        this._updateMiniPortal();
        this.mapViewport.setSize(width, height);
    }

    private _updateMiniPortal() {
        let configuredHeight = this.getMiniPortalHeight();

        if (this._miniPortalConfiguredHeight != configuredHeight) {
            this._miniPortalConfiguredHeight = configuredHeight;
            this._miniPortalHeight = configuredHeight;
        }

        this._miniPortalHeight = clamp(
            this._miniPortalHeight,
            MINI_PORTAL_MIN_PERCENT,
            MINI_PORTAL_MAX_PERCENT
        );

        this.miniPortalVisible = this.getMiniPortalVisible();

        if (this.miniPortalVisible === true) {
            this._showMiniPortal();
        } else {
            this._hideMiniPortal();
            return;
        }

        let heightOffset = this.getMiniPortalHeightPadding();
        let widthPercent = this.getMiniPortalWidth();
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

        this.miniViewport.setOrigin(
            mainViewportWidth / 2 - this.miniViewport.getSize().x / 2,
            heightOffset
        );

        this._updateMiniPortalSlider();

        if (this.miniCameraRig) {
            this.overrideOrthographicViewportZoom(this.miniCameraRig);
            resizeCameraRig(this.miniCameraRig);
        }

        this.miniViewport.updateViewport();
    }

    /**
     * Updates the positioning of the resize indicators for the mini portal.
     */
    private _updateMiniPortalSlider() {
        const height = this.mainViewport.height;
        // set the new slider's top position to the top of the mini portal viewport
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

    private _hideMiniPortal() {
        this.miniViewport.setScale(null, 0);
        (<HTMLElement>this.slider).style.display = 'none';
    }

    private _showMiniPortal() {
        (<HTMLElement>this.slider).style.display = 'block';
    }

    protected frameUpdate(xrFrame?: any) {
        super.frameUpdate(xrFrame);
        TWEEN.update(this.time.timeSinceStart * 1000);

        if (this.setupDelay) {
            this.onCenterCamera(this.miniCameraRig);
            this.setupDelay = false;
        }

        this._updateDefaultZoomAndRotation();
        this._updateMiniPortalVisibility();
        this._updateMiniPortalControls();
        this._updateMainControls();
        this._updateCanvasTransparency();
        this._updatePixelWidthAndHeight();

        this._updateMapPortal();
    }

    private _updateMapPortal() {
        this._updateMapPortalVisibility();
        this._updateMapPortalBasemap();
    }

    private _updateMapPortalBasemap() {
        const view = this.gameView.getMapView();
        if (view) {
            this.gameView.setBasemap(this.getMapPortalBasemap());
        }
    }

    private _updateMapPortalVisibility() {
        const visible = this.getMapPortalVisible();
        if (this.mapPortalVisible == visible) {
            return;
        }

        this.mapPortalVisible = visible;
        if (visible) {
            this.gameView.enableMapView({
                setup: (context) => {
                    const view = this.gameView.getMapView();
                    const coordinateTransform = this.gameView.getMapCoordinateTransformer();
                    for (let sim of this.mapSimulations) {
                        sim.coordinateTransformer = coordinateTransform;
                        sim.mapView = view;
                    }

                    this.mapRenderer = new WebGLRenderer({
                        context: context.gl,
                        premultipliedAlpha: false,
                        antialias: true,
                    });
                    // this.mapRenderer.setPixelRatio()
                    this.mapRenderer.setViewport(0, 0, view.width, view.height);
                    this.mapRenderer.autoClear = false;
                    // this.mapRenderer.autoClearDepth = false;
                    // this.mapRenderer.autoClearStencil = false;
                    // this.mapRenderer.autoClearColor = false;
                    this.mapRenderer.shadowMap.enabled = false;
                    this.mapRenderer.outputEncoding = sRGBEncoding;
                    this.mapViewport.layer = 0.5;

                    // The ArcGIS API for JavaScript renders to custom offscreen buffers, and not to the default framebuffers.
                    // We have to inject this bit of code into the three.js runtime in order for it to bind those
                    // buffers instead of the default ones.
                    let originalSetRenderTarget = this.mapRenderer.setRenderTarget.bind(
                        this.mapRenderer
                    );
                    this.mapRenderer.setRenderTarget = (target) => {
                        originalSetRenderTarget(target);
                        if (target == null) {
                            context.bindRenderTarget();
                        }
                    };
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

                    // this.renderMapViewport();
                },
                dispose: (context) => {},
            });
        }
    }

    private _updatePixelWidthAndHeight() {
        const renderingSize = new Vector2();
        this.renderer.getSize(renderingSize);

        for (let [id, sim] of appManager.simulationManager.simulations) {
            const portalConfig = getPortalConfigBot(sim, 'pagePortal');
            if (
                portalConfig &&
                (portalConfig.tags['pixelWidth'] !== renderingSize.x ||
                    portalConfig.tags['pixelHeight'] !== renderingSize.y)
            ) {
                sim.helper.updateBot(portalConfig, {
                    tags: {
                        pixelWidth: renderingSize.x,
                        pixelHeight: renderingSize.y,
                    },
                });
            }
        }
    }

    private _updateCanvasTransparency() {
        if (
            this.disableCanvasTransparency !==
            this.getDisableCanvasTransparency()
        ) {
            this.disableCanvasTransparency = this.getDisableCanvasTransparency();
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

            mainControls.controls.minZoom = this.getZoomMin();
            mainControls.controls.maxZoom = this.getZoomMax();

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

        if (!this.getMiniPortalResizable() || !this.miniPortalVisible) {
            // remove dragging areas
            (<HTMLElement>this.slider).style.display = 'none';
        } else {
            // make sure dragging areas are active
            (<HTMLElement>this.slider).style.display = 'block';
        }
    }

    private _updateMiniPortalControls() {
        if (this.miniPortalControls != null) {
            this.miniPortalControls.controls.enablePan = this.getMiniPortalPannable();
            this.miniPortalControls.controls.enableRotate = this.getMiniPortalRotatable();
            this.miniPortalControls.controls.enableZoom = this.getMiniPortalZoomable();

            this.miniPortalControls.controls.minPanX = this.getMiniPortalPanMinX();
            this.miniPortalControls.controls.maxPanX = this.getMiniPortalPanMaxX();

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
                let targetWorld: Vector3 = this.miniPortalControls.controls.target.clone();
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
        const isMiniPortal = Input.pagePositionOnViewport(
            pagePos,
            miniViewport,
            this.getViewports()
        );
        this.backgroundCursor = isMiniPortal
            ? this.getMiniPortalCursor()
            : this.getCursor();

        super.renderCursor();
    }

    protected updateInteraction() {
        super.updateInteraction();
        this._updateMiniPortalSize();
    }

    private _updateMiniPortalSize() {
        if (!this.getMiniPortalResizable() || !this.miniPortalVisible) {
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
                this.miniPortalControls = this.interaction.cameraRigControllers.find(
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
        viewport: Viewport
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
            const mapView = this.gameView.getMapView();
            if (mapView && mapView.ready) {
                const instant = options.duration <= 0;
                const [lon, lat] = ExternalRenderers.fromRenderCoordinates(
                    mapView,
                    [position.x, position.y, position.z],
                    0,
                    [0, 0, 0],
                    0,
                    SpatialReference.WGS84,
                    1
                );

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
