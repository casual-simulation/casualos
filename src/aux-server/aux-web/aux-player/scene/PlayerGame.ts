import { Game } from '../../shared/scene/Game';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import {
    CameraRig,
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
} from 'three';
import { PlayerPageSimulation3D } from './PlayerPageSimulation3D';
import { InventorySimulation3D } from './InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first } from 'rxjs/operators';
import flatMap from 'lodash/flatMap';
import uniq from 'lodash/uniq';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    clamp,
    DEFAULT_INVENTORY_VISIBLE,
    DEFAULT_PORTAL_SHOW_FOCUS_POINT,
    DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY,
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
import { ItemDimension } from '../ItemDimension';
import { DimensionItem } from '../DimensionItem';
import { getBotsStateFromStoredAux } from '@casual-simulation/aux-vm';
import { GameAudio } from '../../shared/scene/GameAudio';

export class PlayerGame extends Game {
    gameView: PlayerGameView;

    playerSimulations: PlayerPageSimulation3D[] = [];
    inventorySimulations: InventorySimulation3D[] = [];
    inventoryCameraRig: CameraRig = null;
    inventoryViewport: Viewport = null;
    showInventoryCameraRigHome: boolean = false;
    disableCanvasTransparency: boolean = DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY;

    startZoom: number;
    startAspect: number;

    private inventoryScene: Scene;

    inventoryHeightOverride: number = null;

    private _sliderLeft: Element;
    private _sliderRight: Element;
    private _menuElement: Element;

    private get sliderLeft() {
        if (!this._sliderLeft) {
            this._sliderLeft = document.querySelector('.slider-hiddenLeft');
        }
        return this._sliderLeft;
    }

    private get sliderRight() {
        if (!this._sliderRight) {
            this._sliderRight = document.querySelector('.slider-hiddenRight');
        }
        return this._sliderRight;
    }

    private get menuElement() {
        if (!this._menuElement) {
            this._menuElement = document.querySelector('.toolbar.menu');
        }
        return this._menuElement;
    }

    private sliderPressed: boolean = false;

    setupDelay: boolean = false;

    invVisibleCurrent: boolean = DEFAULT_INVENTORY_VISIBLE;
    defaultHeightCurrent: number = 0;

    defaultZoom: number = null;
    defaultRotationX: number = null;
    defaultRotationY: number = null;

    invController: CameraRigControls;
    invOffsetCurr: number = 0;
    invOffsetDelta: number = 0;
    firstPan: boolean = true;
    panValueCurr: number = 0;
    startOffset: number = 0;

    menuOffset: number = 15;

    audio: GameAudio;

    inventoryFocusPoint: Mesh;
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

    getInventoryVisible(): boolean {
        return this._getSimulationValue(
            this.inventorySimulations,
            'hasDimension',
            DEFAULT_INVENTORY_VISIBLE
        );
    }

    getInventoryHeight(): number {
        return this._getSimulationValue(this.inventorySimulations, 'height', 1);
    }

    getInventoryPannable(): boolean {
        return this._getSimulationValue(this.inventorySimulations, 'pannable');
    }

    getInventoryPanMinX(): number {
        return this._getSimulationValue(this.inventorySimulations, 'panMinX');
    }

    getInventoryPanMaxX(): number {
        return this._getSimulationValue(this.inventorySimulations, 'panMaxX');
    }

    getInventoryPanMinY(): number {
        return this._getSimulationValue(this.inventorySimulations, 'panMinY');
    }

    getInventoryPanMaxY(): number {
        return this._getSimulationValue(this.inventorySimulations, 'panMaxY');
    }

    getInventoryZoomable(): boolean {
        return this._getSimulationValue(this.inventorySimulations, 'zoomable');
    }

    getInventoryRotatable(): boolean {
        return this._getSimulationValue(this.inventorySimulations, 'rotatable');
    }

    getInventoryResizable(): boolean {
        return this._getSimulationValue(this.inventorySimulations, 'resizable');
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

    getInventoryColor(): Color | Texture {
        return this._getSimulationValue(
            this.inventorySimulations,
            'backgroundColor'
        );
    }

    getInventoryShowFocusPoint(): boolean {
        return this._getSimulationValue(
            this.inventorySimulations,
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
        return [this.mainViewport, this.inventoryViewport];
    }
    getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig, this.inventoryCameraRig];
    }
    getSimulations(): Simulation3D[] {
        return [...this.playerSimulations, ...this.inventorySimulations];
        // return [...this.playerSimulations];
        // return [...this.inventorySimulations];
    }
    getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.gameView.$refs.inventory];
    }
    getInventoryViewport(): Viewport {
        return this.inventoryViewport;
    }
    getInventoryCameraRig(): CameraRig {
        return this.inventoryCameraRig;
    }
    findBotsById(id: string): AuxBotVisualizer[] {
        return flatMap(this.playerSimulations, s => s.bots).filter(
            b => b.bot.id === id
        );
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
     * Find Inventory Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findInventorySimulation3D(sim: BrowserSimulation): InventorySimulation3D {
        return this.inventorySimulations.find(s => s.simulation === sim);
    }

    /**
     * Find Player Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findPlayerSimulation3D(sim: BrowserSimulation): PlayerPageSimulation3D {
        return this.playerSimulations.find(s => s.simulation === sim);
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
                        sim =>
                            sim.connection.syncStateChanged.pipe(
                                first(sync => sync)
                            ),
                        (sim, sync) => sim
                    ),
                    tap(sim => {
                        this.simulationAdded(sim);
                    })
                )
                .subscribe()
        );

        this.subs.push(
            appManager.simulationManager.simulationRemoved
                .pipe(
                    tap(sim => {
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
        // Create Inventory Simulation
        //
        const inventorySim3D = new InventorySimulation3D(this, sim);
        inventorySim3D.init();
        inventorySim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        inventorySim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        inventorySim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.inventorySimulations.push(inventorySim3D);
        this.inventoryScene.add(inventorySim3D);

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe(e => {
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
                    this.playAudio(e.url);
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
                }
            })
        );
    }

    playAudio(url: string) {
        if (url === null) return;

        this.audio.playFromUrl(url);
    }

    private simulationRemoved(sim: BrowserSimulation) {
        //
        // Remove Player Simulation
        //
        const playerSimIndex = this.playerSimulations.findIndex(
            s => s.simulation.id === sim.id
        );
        if (playerSimIndex >= 0) {
            const removed = this.playerSimulations.splice(playerSimIndex, 1);
            removed.forEach(s => {
                s.onBotAdded.removeListener(this.onBotAdded.invoke);
                s.onBotRemoved.removeListener(this.onBotRemoved.invoke);
                s.onBotUpdated.removeListener(this.onBotUpdated.invoke);
                s.unsubscribe();
                this.mainScene.remove(s);
            });
        }

        //
        // Remove Inventory Simulation
        //
        const invSimIndex = this.inventorySimulations.findIndex(
            s => s.simulation.id == sim.id
        );

        if (invSimIndex >= 0) {
            const removed = this.inventorySimulations.splice(invSimIndex, 1);
            removed.forEach(s => {
                s.onBotAdded.removeListener(this.onBotAdded.invoke);
                s.onBotRemoved.removeListener(this.onBotRemoved.invoke);
                s.onBotUpdated.removeListener(this.onBotUpdated.invoke);
                s.unsubscribe();
                this.inventoryScene.remove(s);
            });
        }
    }

    resetCameras() {
        this.interaction.cameraRigControllers.forEach(controller => {
            if (controller.rig.name != 'inventory') controller.controls.reset();
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
        super.renderBrowser();

        this.inventoryCameraRig.mainCamera.updateMatrixWorld(true);

        //
        // [Inventory scene]
        //

        this.renderer.clearDepth(); // Clear depth buffer so that inventory scene always appears above the main scene.

        if (this.mainScene.background instanceof Color) {
            this.inventorySceneBackgroundUpdate(this.mainScene.background);
        }

        this.renderer.setViewport(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );
        this.renderer.setScissor(
            this.inventoryViewport.x,
            this.inventoryViewport.y,
            this.inventoryViewport.width,
            this.inventoryViewport.height
        );

        this.renderer.setScissorTest(true);

        // Render the inventory scene with the inventory main camera.
        this.renderer.render(
            this.inventoryScene,
            this.inventoryCameraRig.mainCamera
        );
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

    private inventorySceneBackgroundUpdate(colorToOffset: Color) {
        if (!colorToOffset) return;

        let invColor: Color | Texture = colorToOffset.clone();
        let tagColor = this.getInventoryColor();

        if (tagColor != undefined) {
            invColor = tagColor;
        } else {
            invColor.offsetHSL(0, -0.02, -0.04);
        }

        this.inventoryScene.background = invColor;
    }

    protected setupRendering() {
        super.setupRendering();

        this.inventoryViewport = new Viewport('inventory', this.mainViewport);
        console.log(
            'Set height initial value: ' + this.inventoryViewport.height
        );
        this.inventoryViewport.layer = 1;
    }

    protected setupScenes() {
        super.setupScenes();

        //
        // [Inventory scene]
        //
        this.inventoryScene = new Scene();
        this.inventoryScene.autoUpdate = false;

        // Inventory camera.
        this.inventoryCameraRig = createCameraRig(
            'inventory',
            'orthographic',
            this.inventoryScene,
            this.inventoryViewport
        );
        this.inventoryCameraRig.mainCamera.zoom = 50;

        // Inventory ambient light.
        const invAmbient = baseAuxAmbientLight();
        this.inventoryScene.add(invAmbient);

        // Inventory direction light.
        const invDirectional = baseAuxDirectionalLight();
        this.inventoryScene.add(invDirectional);

        this.setupDelay = true;

        this.audio = new GameAudio();
    }

    onWindowResize(width: number, height: number) {
        super.onWindowResize(width, height);

        this.firstPan = true;
        if (this.inventoryHeightOverride === null) {
            this.setupInventory(height);
        }

        this.setupInventory(height);
    }

    setupInventory(height: number) {
        let invHeightScale = 1;

        let defaultHeight = this.getInventoryHeight();

        if (this.defaultHeightCurrent != this.getInventoryHeight()) {
            this.inventoryHeightOverride = null;
            this.defaultHeightCurrent = this.getInventoryHeight();
        }

        if (defaultHeight != null && defaultHeight != 0) {
            if (defaultHeight < 1) {
                invHeightScale = 1;
            } else if (defaultHeight > 10) {
                invHeightScale = 10;
            } else {
                invHeightScale = <number>defaultHeight;
            }
        }

        this.invVisibleCurrent = this.getInventoryVisible();

        if (this.invVisibleCurrent === true) {
            this._showInventory();
        } else {
            this._hideInventory();
            return;
        }

        let w = window.innerWidth;

        if (w > 700) {
            w = 700;
        }

        let unitNum = invHeightScale;
        invHeightScale = (0.11 - 0.04 * ((700 - w) / 200)) * unitNum + 0.02;

        let tempNum = 873 * invHeightScale;
        tempNum = tempNum / window.innerHeight;

        invHeightScale = tempNum;
        this.invOffsetDelta = (49 - 18 * ((700 - w) / 200)) * (unitNum - 1);

        // if there is no existing height set by the slider then
        if (this.inventoryHeightOverride === null) {
            let invOffsetHeight = 40;

            if (window.innerWidth <= 700) {
                invOffsetHeight = window.innerWidth * 0.05;
                this.inventoryViewport.setScale(0.9, invHeightScale);
            } else {
                this.inventoryViewport.setScale(0.8, invHeightScale);
            }

            if (this.inventoryViewport.getSize().x > 700) {
                let num = 700 / window.innerWidth;
                this.inventoryViewport.setScale(num, invHeightScale);
            }

            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                invOffsetHeight
            );

            // set the new slider's top position to the top of the inventory viewport
            let sliderTop =
                height - this.inventoryViewport.height - (invOffsetHeight - 10);
            (<HTMLElement>this.sliderLeft).style.top =
                sliderTop.toString() + 'px';

            //waaa
            (<HTMLElement>this.menuElement).style.bottom =
                (window.innerHeight - sliderTop + this.menuOffset).toString() +
                'px';

            (<HTMLElement>this.sliderRight).style.top =
                sliderTop.toString() + 'px';

            this.inventoryHeightOverride =
                this.inventoryViewport.getSize().y - 5;

            (<HTMLElement>this.sliderLeft).style.left =
                (this.inventoryViewport.x - 15).toString() + 'px';

            (<HTMLElement>this.sliderRight).style.left =
                (
                    this.inventoryViewport.x +
                    this.inventoryViewport.getSize().x -
                    15
                ).toString() + 'px';

            (<HTMLElement>this.menuElement).style.left =
                this.inventoryViewport.x.toString() + 'px';

            (<HTMLElement>this.menuElement).style.width =
                this.inventoryViewport.width.toString() + 'px';
        } else {
            let invOffsetHeight = 40;

            if (window.innerWidth < 700) {
                invOffsetHeight = window.innerWidth * 0.05;
                this.inventoryViewport.setScale(0.9, invHeightScale);
            } else {
                this.inventoryViewport.setScale(0.8, invHeightScale);
            }

            if (this.inventoryViewport.getSize().x > 700) {
                let num = 700 / window.innerWidth;
                this.inventoryViewport.setScale(num, invHeightScale);
            }

            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                invOffsetHeight
            );

            let sliderTop =
                height - this.inventoryViewport.height - invOffsetHeight - 10;
            (<HTMLElement>this.sliderLeft).style.top =
                sliderTop.toString() + 'px';

            (<HTMLElement>this.sliderRight).style.top =
                sliderTop.toString() + 'px';

            (<HTMLElement>this.sliderLeft).style.left =
                (this.inventoryViewport.x - 12).toString() + 'px';

            (<HTMLElement>this.sliderRight).style.left =
                (
                    this.inventoryViewport.x +
                    this.inventoryViewport.getSize().x -
                    12
                ).toString() + 'px';

            (<HTMLElement>this.menuElement).style.bottom =
                (window.innerHeight - sliderTop + this.menuOffset).toString() +
                'px';

            (<HTMLElement>this.menuElement).style.left =
                this.inventoryViewport.x.toString() + 'px';

            (<HTMLElement>this.menuElement).style.width =
                this.inventoryViewport.width.toString() + 'px';
        }

        if (this.inventoryCameraRig) {
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
            resizeCameraRig(this.inventoryCameraRig);
        }
    }

    private _hideInventory() {
        this.inventoryViewport.setScale(null, 0);
        (<HTMLElement>this.sliderLeft).style.display = 'none';
        (<HTMLElement>this.sliderRight).style.display = 'none';
        (<HTMLElement>this.menuElement).style.bottom =
            this.menuOffset.toString() + 'px';
        (<HTMLElement>this.menuElement).style.left = null;
        (<HTMLElement>this.menuElement).style.width = null;
    }

    private _showInventory() {
        (<HTMLElement>this.sliderLeft).style.display = 'block';
        (<HTMLElement>this.sliderRight).style.display = 'block';
    }

    async mouseDownSlider() {
        if (!this.getInventoryResizable()) return;

        this.sliderPressed = true;

        if (this.inventoryCameraRig.mainCamera instanceof OrthographicCamera) {
            this.startAspect =
                this.inventoryCameraRig.viewport.width /
                this.inventoryCameraRig.viewport.height;
            this.startZoom = this.inventoryCameraRig.mainCamera.zoom;
            this.startOffset = this.panValueCurr;
        }
    }

    async mouseUpSlider() {
        let invOffsetHeight = 40;

        if (window.innerWidth < 700) {
            invOffsetHeight = window.innerWidth * 0.05;
        }

        this.sliderPressed = false;
        let sliderTop =
            window.innerHeight -
            this.inventoryViewport.height -
            invOffsetHeight;
        (<HTMLElement>this.sliderLeft).style.top = sliderTop.toString() + 'px';

        (<HTMLElement>this.sliderRight).style.top = sliderTop.toString() + 'px';

        (<HTMLElement>this.menuElement).style.bottom =
            (window.innerHeight - sliderTop + this.menuOffset - 8).toString() +
            'px';
    }

    protected frameUpdate(xrFrame?: any) {
        super.frameUpdate(xrFrame);

        if (this.setupDelay) {
            this.onCenterCamera(this.inventoryCameraRig);
            this.setupDelay = false;
        } else if (this.firstPan) {
            this.firstPan = false;
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
        }

        if (
            this.defaultZoom === null &&
            this.defaultRotationX === null &&
            this.defaultRotationY === null
        ) {
            let zoomNum = this.getPlayerZoom();
            if (zoomNum != null) {
                zoomNum = clamp(zoomNum, 0, 80);
            }

            let rotX = this.getPlayerRotationX();
            let rotY = this.getPlayerRotationY();

            if (rotX != null) {
                rotX = clamp(rotX, 1, 90);
                rotX = rotX / 180;
            } else {
                rotX = 0.0091;
            }

            if (rotY != null) {
                rotY = clamp(rotY, -180, 180);
                rotY = rotY / 180;
            } else {
                rotY = 0.0091;
            }

            if (
                (zoomNum != undefined && zoomNum != this.defaultZoom) ||
                (rotX != undefined && rotX != this.defaultRotationX) ||
                (rotY != undefined && rotY != this.defaultRotationY)
            ) {
                if (rotX != null && rotY != null) {
                    this.setCameraToPosition(
                        this.mainCameraRig,
                        new Vector3(0, 0, 0),
                        zoomNum,
                        new Vector2(rotX, rotY)
                    );
                } else {
                    this.setCameraToPosition(
                        this.mainCameraRig,
                        new Vector3(0, 0, 0),
                        zoomNum
                    );
                }
            }

            this.defaultZoom = zoomNum;
            this.defaultRotationX = rotX;
            this.defaultRotationY = rotY;
        }

        if (
            this.invVisibleCurrent != this.getInventoryVisible() ||
            this.defaultHeightCurrent != this.getInventoryHeight()
        ) {
            this.setupInventory(window.innerHeight);
        }

        if (this.invController != null) {
            this.invController.controls.enablePan = this.getInventoryPannable();
            this.invController.controls.enableRotate = this.getInventoryRotatable();
            this.invController.controls.enableZoom = this.getInventoryZoomable();

            this.invController.controls.minPanX = this.getInventoryPanMinX();
            this.invController.controls.maxPanX = this.getInventoryPanMaxX();

            //this.invController.controls.minPanY = this.getPanMinY();

            if (this.getInventoryPanMinY() != null) {
                this.invController.controls.minPanY =
                    this.getInventoryPanMinY() * -1;
            } else {
                this.invController.controls.minPanY = null;
            }

            if (this.getInventoryPanMaxY() != null) {
                this.invController.controls.maxPanY =
                    this.getInventoryPanMaxY() * -1;
            } else {
                this.invController.controls.maxPanY = null;
            }

            const showFocus = this.getInventoryShowFocusPoint();
            if (showFocus && !this.xrSession) {
                if (!this.inventoryFocusPoint) {
                    this.inventoryFocusPoint = createFocusPointSphere();
                    this.inventoryScene.add(this.inventoryFocusPoint);
                }
                this.inventoryFocusPoint.visible = true;
                this.inventoryFocusPoint.position.copy(
                    this.invController.controls.target
                );
                this.inventoryFocusPoint.updateMatrixWorld(true);
            } else {
                if (this.inventoryFocusPoint) {
                    this.inventoryFocusPoint.visible = false;
                    this.inventoryFocusPoint.updateMatrixWorld(true);
                }
            }
        }

        const mainControls = this.interaction.cameraRigControllers.find(
            c => c.rig.name === this.mainCameraRig.name
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
                let target: Vector3 = mainControls.controls.target;
                this.mainFocusPoint.position.copy(target);
                this.mainFocusPoint.updateMatrixWorld(true);
            } else {
                if (this.mainFocusPoint) {
                    this.mainFocusPoint.visible = false;
                    this.mainFocusPoint.updateMatrixWorld(true);
                }
            }
        }

        if (!this.getInventoryResizable() || !this.invVisibleCurrent) {
            if (this.sliderPressed) {
                this.mouseUpSlider();
                this.sliderPressed = false;
            }

            // remove dragging areas
            (<HTMLElement>this.sliderLeft).style.display = 'none';
            (<HTMLElement>this.sliderRight).style.display = 'none';
        } else {
            // make sure dragging areas are active
            (<HTMLElement>this.sliderLeft).style.display = 'block';
            (<HTMLElement>this.sliderRight).style.display = 'block';
        }

        this._updateInventorySize();

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

    private _updateInventorySize() {
        if (!this.sliderPressed) return false;

        let invOffsetHeight: number = 40;

        if (window.innerWidth < 700) {
            invOffsetHeight = window.innerWidth * 0.05;
        }

        let sliderPos = this.input.getMousePagePos().y + invOffsetHeight;

        //prevent the slider from being positioned outside the window bounds
        if (sliderPos < 0) sliderPos = 0;
        if (sliderPos > window.innerHeight - 40)
            sliderPos = window.innerHeight - 40;

        (<HTMLElement>this.sliderLeft).style.top =
            sliderPos - invOffsetHeight + 'px';

        (<HTMLElement>this.sliderRight).style.top =
            sliderPos - invOffsetHeight + 'px';

        let sliderTop =
            window.innerHeight -
            this.inventoryViewport.height -
            invOffsetHeight;

        (<HTMLElement>this.menuElement).style.bottom =
            window.innerHeight - sliderTop + this.menuOffset - 8 + 'px';

        this.inventoryHeightOverride = window.innerHeight - sliderPos;

        let invHeightScale = this.inventoryHeightOverride / window.innerHeight;

        if (invHeightScale < 0.1) {
            invHeightScale = 0.1;
        } else if (invHeightScale > 1) {
            invHeightScale = 1;
        }

        this.inventoryViewport.setScale(null, invHeightScale);

        if (this.inventoryCameraRig) {
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
            resizeCameraRig(this.inventoryCameraRig);
        }

        if (!this.input.getMouseButtonHeld(0)) {
            this.sliderPressed = false;
        }

        let w = window.innerWidth;

        if (w > 700) {
            w = 700;
        }

        let tempNum = invHeightScale * window.innerHeight; // num
        let nNum = tempNum / 873;

        let tempUnitNum = nNum / (0.11 - 0.04 * ((700 - w) / 200));

        if (tempUnitNum <= 1.16) {
            tempUnitNum = 1.16;
            this.invOffsetDelta =
                (49 - 18 * ((700 - w) / 200)) * (tempUnitNum - 1);
        } else {
            this.invOffsetDelta =
                (49 - 18 * ((700 - w) / 200)) * (tempUnitNum - 1) - 8;
        }

        let num = this.invOffsetDelta - this.invOffsetCurr;
        this.invController.controls.setPan(-this.panValueCurr);
        this.panValueCurr += num;

        this.invController.controls.setPan(this.panValueCurr);
        this.invOffsetCurr = this.invOffsetDelta;
    }

    /**
     * This is a hacky function that gets us a more pleasent orthographic zoom level
     * as we change the aspect ratio of the viewport that has an orthographic camera.
     */
    private overrideOrthographicViewportZoom(cameraRig: CameraRig) {
        if (cameraRig.mainCamera instanceof OrthographicCamera) {
            const aspect = cameraRig.viewport.width / cameraRig.viewport.height;

            if (this.startAspect != null) {
                let zoomC = this.startZoom / this.startAspect;
                const newZoom =
                    this.startZoom - (this.startZoom - aspect * zoomC);
                cameraRig.mainCamera.zoom = newZoom;
            } else {
                // edit this number to change the initial zoom number
                let initNum = 240;
                // found that 50 is the preset zoom of the rig.maincamera.zoom so I am using this as the base zoom
                const newZoom = initNum - (initNum - aspect * (initNum / 7));
                cameraRig.mainCamera.zoom = newZoom;
            }
        }

        if (!this.setupDelay) {
            if (this.invController == null) {
                this.invController = this.interaction.cameraRigControllers.find(
                    c => c.rig.name === cameraRig.name
                );
            }

            if (!this.firstPan) {
                let num = this.invOffsetDelta - this.invOffsetCurr;

                // try to center it by using the last offset
                this.invController.controls.setPan(-this.panValueCurr);

                // the final pan movement with the current offset
                this.panValueCurr += num;

                this.invController.controls.setPan(this.panValueCurr);
                this.invOffsetCurr = this.invOffsetDelta;
            }
        }
    }
}
function createFocusPointSphere(): Mesh {
    return createSphere(new Vector3(), 0x4ebdbf, 0.05);
}
