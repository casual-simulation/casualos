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
    AudioListener,
    Audio as ThreeAudio,
    AudioLoader,
    AudioBuffer,
} from 'three';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { InventorySimulation3D } from './InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first } from 'rxjs/operators';
import { flatMap } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import SimulationItem from '../SimulationContext';
import { uniqBy } from 'lodash';
import {
    getBotsStateFromStoredTree,
    calculateBotValue,
    calculateNumericalTagValue,
    clamp,
    calculateBooleanTagValue,
} from '@casual-simulation/aux-common';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
} from '../../shared/scene/SceneUtils';
import {
    Orthographic_MinZoom,
    Orthographic_MaxZoom,
} from '../../shared/scene/CameraRigFactory';
import { Subject } from 'rxjs';
import { MenuItem } from '../MenuContext';
import { CameraRigControls } from '../../shared/interaction/CameraRigControls';

export class PlayerGame extends Game {
    gameView: PlayerGameView;
    botsMode: boolean;
    workspacesMode: boolean;

    playerSimulations: PlayerSimulation3D[] = [];
    inventorySimulations: InventorySimulation3D[] = [];
    inventoryCameraRig: CameraRig = null;
    inventoryViewport: Viewport = null;
    showInventoryCameraRigHome: boolean = false;

    startZoom: number;
    startAspect: number;

    private inventoryScene: Scene;

    inventoryHeightOverride: number = null;

    private sliderLeft: Element;
    private sliderRight: Element;
    private menuElement: Element;
    private sliderPressed: boolean = false;

    setupDelay: boolean = false;

    invVisibleCurrent: boolean = true;
    defaultHeightCurrent: number = 0;
    menuUpdated: Subject<MenuItem[]> = new Subject();

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

    soundListener: AudioListener;
    soundLoader: AudioLoader;
    soundPlayer: ThreeAudio;
    sounds: Map<string, AudioBuffer> = new Map();
    mediaElement: HTMLAudioElement;
    audioAdded: boolean = false;
    currentAudio: string;

    constructor(gameView: PlayerGameView) {
        super(gameView);
    }

    getBackground(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.backgroundColor) {
                return sim.backgroundColor;
            }
        }

        return null;
    }

    getPannable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.pannable != null) {
                return sim.pannable;
            }
        }

        return null;
    }

    getPanMinX(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.panMinX != null) {
                return sim.panMinX;
            }
        }

        return null;
    }

    getPanMaxX(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.panMaxX != null) {
                return sim.panMaxX;
            }
        }

        return null;
    }

    getPanMinY(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.panMinY != null) {
                return sim.panMinY;
            }
        }

        return null;
    }

    getPanMaxY(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.panMaxY != null) {
                return sim.panMaxY;
            }
        }

        return null;
    }

    getZoomable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.zoomable != null) {
                return sim.zoomable;
            }
        }

        return null;
    }

    getZoomMin(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.zoomMin != null) {
                return sim.zoomMin;
            }
        }
        return Orthographic_MinZoom;
    }

    getZoomMax(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.zoomMax != null) {
                return sim.zoomMax;
            }
        }
        return Orthographic_MaxZoom;
    }

    getRotatable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.rotatable != null) {
                return sim.rotatable;
            }
        }

        return null;
    }

    getInventoryVisible(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryVisible != null) {
                return sim.inventoryVisible;
            }
        }

        return null;
    }

    getInventoryHeight(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryHeight != null) {
                return sim.inventoryHeight;
            }
        }

        return 1;
    }

    getInventoryPannable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryPannable != null) {
                return sim.inventoryPannable;
            }
        }

        return null;
    }

    getInventoryZoomable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryZoomable != null) {
                return sim.inventoryZoomable;
            }
        }

        return null;
    }

    getInventoryRotatable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryRotatable != null) {
                return sim.inventoryRotatable;
            }
        }

        return null;
    }

    getInventoryResizable(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryResizable != null) {
                return sim.inventoryResizable;
            }
        }

        return null;
    }

    getPlayerZoom(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerZoom != null) {
                return sim.playerZoom;
            }
        }

        return null;
    }

    getPlayerRotationX(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerRotationX != null) {
                return sim.playerRotationX;
            }
        }

        return null;
    }

    getPlayerRotationY(): number {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.playerRotationY != null) {
                return sim.playerRotationY;
            }
        }

        return null;
    }

    getInventoryColor(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.inventoryColor) {
                return sim.inventoryColor;
            }
        }

        return null;
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
    findBotsById(id: string): AuxBot3D[] {
        return flatMap(flatMap(this.playerSimulations, s => s.contexts), c =>
            c.getBots().filter(f => f.bot.id === id)
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
    findPlayerSimulation3D(sim: BrowserSimulation): PlayerSimulation3D {
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
        const playerSim3D = new PlayerSimulation3D(
            this.gameView.context,
            this,
            sim
        );
        playerSim3D.init();
        playerSim3D.onBotAdded.addListener(this.onBotAdded.invoke);
        playerSim3D.onBotRemoved.addListener(this.onBotRemoved.invoke);
        playerSim3D.onBotUpdated.addListener(this.onBotUpdated.invoke);

        this.subs.push(
            playerSim3D.simulationContext.itemsUpdated.subscribe(() => {
                this.onSimsUpdated();
            }),
            playerSim3D.menuContext.itemsUpdated.subscribe(() => {
                this.onMenuUpdated();
            })
        );

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe(e => {
                if (e.type === 'go_to_context') {
                    this.resetCameras();
                    this.playerSimulations.forEach(s => {
                        s.setContext(e.context);
                    });
                } else if (e.type === 'import_aux') {
                    this.importAUX(sim, e.url);
                } else if (e.type === 'play_sound') {
                    this.playAudio(e.url);
                }
            })
        );

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
    }

    createAudio() {
        if (!this.audioAdded) {
            this.soundListener = new AudioListener();
            this.soundPlayer = new ThreeAudio(this.soundListener);
            this.soundLoader = new AudioLoader();

            this.mediaElement = new Audio('');
            this.mediaElement.loop = false;
            this.mediaElement.play();
            this.mediaElement.pause();
            this.mediaElement.currentTime = 0;

            this.audioAdded = true;
        }
    }

    playAudio(url: string) {
        if (url === null) return;

        //if(this.currentAudio != url){
        this.mediaElement.src = url;
        this.mediaElement.load();
        //this.currentAudio = url;
        //}

        if (this.mediaElement.currentTime != 0) {
            this.mediaElement.currentTime = 0;
        }
        this.mediaElement.play();
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

    private onSimsUpdated() {
        let items: SimulationItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.simulationContext) {
                for (let i = 0; i < sim.simulationContext.items.length; i++) {
                    items[i] = sim.simulationContext.items[i];
                }
            }
        });

        items = uniqBy(items, i => i.simulationToLoad);
        appManager.simulationManager.updateSimulations([
            appManager.simulationManager.primary.id,
            ...items.map(i => i.simulationToLoad),
        ]);
    }

    private onMenuUpdated() {
        let items: MenuItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });

        this.menuUpdated.next(items);
    }

    resetCameras() {
        this.interaction.cameraRigControllers.forEach(controller => {
            if (controller.rig.name != 'inventory') controller.controls.reset();
        });
    }

    private async importAUX(sim: BrowserSimulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getBotsStateFromStoredTree(stored);
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

    protected setupRenderer() {
        super.setupRenderer();

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

        const context = appManager.simulationManager.primary.helper.createContext();
        const globalsBot =
            appManager.simulationManager.primary.helper.globalsBot;
        let defaultHeight = this.getInventoryHeight();

        if (this.defaultHeightCurrent != this.getInventoryHeight()) {
            this.inventoryHeightOverride = null;
        }

        if (defaultHeight === null || defaultHeight === 0) {
            calculateNumericalTagValue(
                context,
                globalsBot,
                'aux.context.inventory.height',
                null
            );
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

        this.defaultHeightCurrent = defaultHeight;
        this.invVisibleCurrent = this.getInventoryVisible();

        if (this.invVisibleCurrent === false) {
            this.inventoryViewport.setScale(null, 0);
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            if (this.menuElement === undefined)
                this.menuElement = document.querySelector('.toolbar.menu');

            (<HTMLElement>this.sliderLeft).style.display = 'none';
            (<HTMLElement>this.sliderRight).style.display = 'none';

            return;
        } else {
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            if (this.menuElement === undefined)
                this.menuElement = document.querySelector('.toolbar.menu');

            (<HTMLElement>this.sliderLeft).style.display = 'block';
            (<HTMLElement>this.sliderRight).style.display = 'block';
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
            // get a new reference to the slider object in the html
            if (this.sliderLeft === undefined)
                this.sliderLeft = document.querySelector('.slider-hiddenLeft');

            if (this.sliderRight === undefined)
                this.sliderRight = document.querySelector(
                    '.slider-hiddenRight'
                );

            if (this.menuElement === undefined)
                this.menuElement = document.querySelector('.toolbar.menu');

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
