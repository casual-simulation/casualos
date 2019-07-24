import { Game } from '../../shared/scene/Game';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import {
    CameraRig,
    createCameraRig,
    resizeCameraRig,
} from '../../shared/scene/CameraRigFactory';
import { Scene, Color, Texture, OrthographicCamera } from 'three';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { InventorySimulation3D } from './InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import { appManager } from '../../shared/AppManager';
import { tap, mergeMap, first } from 'rxjs/operators';
import { flatMap } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import SimulationItem from '../SimulationContext';
import { uniqBy } from 'lodash';
import { getFilesStateFromStoredTree } from '@casual-simulation/aux-common';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
} from '../../shared/scene/SceneUtils';
import { WebVRDisplays } from '../../shared/WebVRDisplays';

export class PlayerGame extends Game {
    gameView: PlayerGameView;
    filesMode: boolean;
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

    private slider: Element;
    private sliderVis: Element;
    private sideVis: Element;
    private sliderPressed: boolean = false;

    setupDelay: boolean = false;

    invVisibleCurrent: boolean = true;

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

    getInventoryVisible(): boolean {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];

            if (sim.inventoryVisible != null) {
                return sim.inventoryVisible;
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
    findFilesById(id: string): AuxFile3D[] {
        return flatMap(flatMap(this.playerSimulations, s => s.contexts), c =>
            c.getFiles().filter(f => f.file.id === id)
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
        playerSim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        playerSim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        playerSim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this.subs.push(
            playerSim3D.simulationContext.itemsUpdated.subscribe(() => {
                this.onSimsUpdated();
            })
        );

        this.subs.push(
            playerSim3D.simulation.localEvents.subscribe(e => {
                if (e.name === 'go_to_context') {
                    this.playerSimulations.forEach(s => {
                        s.setContext(e.context);
                    });
                } else if (e.name === 'import_aux') {
                    this.importAUX(sim, e.url);
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
        inventorySim3D.onFileAdded.addListener(this.onFileAdded.invoke);
        inventorySim3D.onFileRemoved.addListener(this.onFileRemoved.invoke);
        inventorySim3D.onFileUpdated.addListener(this.onFileUpdated.invoke);

        this.inventorySimulations.push(inventorySim3D);
        this.inventoryScene.add(inventorySim3D);
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
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
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
                s.onFileAdded.removeListener(this.onFileAdded.invoke);
                s.onFileRemoved.removeListener(this.onFileRemoved.invoke);
                s.onFileUpdated.removeListener(this.onFileUpdated.invoke);
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

    private async importAUX(sim: BrowserSimulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getFilesStateFromStoredTree(stored);
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
        super.renderVR();
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

        this.setupInventory(height);
    }

    setupInventory(height: number) {
        let invHeightScale = height < 850 ? 0.25 : 0.2;

        let defaultHeight =
            appManager.simulationManager.primary.helper.globalsFile.tags[
                'aux.inventory.height'
            ];

        if (defaultHeight != null && defaultHeight != 0) {
            if (defaultHeight < 0.1) {
                invHeightScale = 0.1;
            } else if (defaultHeight > 1) {
                invHeightScale = 1;
            } else {
                invHeightScale = <number>defaultHeight;
            }
        }

        this.invVisibleCurrent = this.getInventoryVisible();

        if (this.invVisibleCurrent === false) {
            this.inventoryViewport.setScale(null, 0);
            this.slider = document.querySelector('.slider-hidden');
            this.sliderVis = document.querySelector('.slider-visible');
            this.sideVis = document.querySelector('.side-visible');
            (<HTMLElement>this.slider).style.display = 'none';
            (<HTMLElement>this.sliderVis).style.display = 'none';
            (<HTMLElement>this.sideVis).style.display = 'none';

            return;
        } else {
            this.slider = document.querySelector('.slider-hidden');
            this.sliderVis = document.querySelector('.slider-visible');
            this.sideVis = document.querySelector('.side-visible');
            (<HTMLElement>this.slider).style.display = 'block';
            (<HTMLElement>this.sliderVis).style.display = 'block';
            (<HTMLElement>this.sideVis).style.display = 'block';
        }

        // if there is no existing height set by the slider then
        if (this.inventoryHeightOverride === null) {
            // get a new reference to the slider object in the html
            this.slider = document.querySelector('.slider-hidden');
            this.sliderVis = document.querySelector('.slider-visible');

            this.inventoryViewport.setScale(0.8, invHeightScale);
            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                0
            );

            // set the new slider's top position to the top of the viewport
            (<HTMLElement>this.slider).style.top =
                (height - this.inventoryViewport.height - 20).toString() + 'px';
            (<HTMLElement>this.sliderVis).style.top =
                (height - this.inventoryViewport.height).toString() + 'px';

            this.inventoryHeightOverride =
                height -
                +(<HTMLElement>this.slider).style.top.replace('px', '');
        } else {
            console.log('NNNNNNNNNNNNNNNNNNN: ' + window.innerWidth);
            invHeightScale = this.inventoryHeightOverride / height;
            this.inventoryViewport.setScale(0.8, invHeightScale);

            if (this.inventoryViewport.getSize().x > 700) {
                let num = 700 / window.innerWidth;
                console.log('AAAAAAAAAAAAAAAAAAAA');
                this.inventoryViewport.setScale(num, invHeightScale);
            }

            let x =
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2;

            this.inventoryViewport.setOrigin(
                window.innerWidth / 2 - this.inventoryViewport.getSize().x / 2,
                0
            );

            (<HTMLElement>this.slider).style.top =
                (height - this.inventoryViewport.height).toString() + 'px';

            (<HTMLElement>this.sliderVis).style.top =
                (
                    window.innerHeight -
                    this.inventoryViewport.height +
                    16
                ).toString() + 'px';

            (<HTMLElement>this.sliderVis).style.width =
                this.inventoryViewport.getSize().x.toString() + 'px';

            (<HTMLElement>this.sliderVis).style.left =
                this.inventoryViewport.x
                    //-window.innerWidth/3.34 + this.inventoryViewport.getSize().x/2
                    .toString() + 'px';

            (<HTMLElement>this.slider).style.width =
                this.inventoryViewport.getSize().x.toString() + 'px';

            (<HTMLElement>this.slider).style.left =
                this.inventoryViewport.x.toString() + 'px';

            (<HTMLElement>this.sideVis).style.left =
                this.inventoryViewport.x.toString() + 'px';

            (<HTMLElement>this.sideVis).style.top =
                (
                    window.innerHeight -
                    this.inventoryViewport.height +
                    16
                ).toString() + 'px';
        }

        if (this.inventoryCameraRig) {
            this.overrideOrthographicViewportZoom(this.inventoryCameraRig);
            resizeCameraRig(this.inventoryCameraRig);
        }
    }

    async mouseDownSlider() {
        this.sliderPressed = true;

        if (this.inventoryCameraRig.mainCamera instanceof OrthographicCamera) {
            this.startAspect =
                this.inventoryCameraRig.viewport.width /
                this.inventoryCameraRig.viewport.height;
            this.startZoom = this.inventoryCameraRig.mainCamera.zoom;
        }
    }

    async mouseUpSlider() {
        this.sliderPressed = false;
        (<HTMLElement>this.slider).style.top =
            (
                window.innerHeight -
                this.inventoryViewport.height +
                5.5
            ).toString() + 'px';
    }

    protected frameUpdate(xrFrame?: any) {
        super.frameUpdate(xrFrame);

        if (this.setupDelay) {
            this.onCenterCamera(this.inventoryCameraRig);
            this.setupDelay = false;
        }

        if (this.invVisibleCurrent != this.getInventoryVisible()) {
            this.setupInventory(window.innerHeight);
        }

        if (!this.sliderPressed) return false;

        let sliderPos = this.input.getMousePagePos().y;

        //prevent the slider from being positioned outside the window bounds
        if (sliderPos < 0) sliderPos = 0;
        if (sliderPos > window.innerHeight) sliderPos = window.innerHeight;

        (<HTMLElement>this.slider).style.top = sliderPos + 'px';

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

        (<HTMLElement>this.sliderVis).style.top =
            (
                window.innerHeight -
                this.inventoryViewport.height +
                16
            ).toString() + 'px';

        (<HTMLElement>this.sideVis).style.top =
            (
                window.innerHeight -
                this.inventoryViewport.height +
                16
            ).toString() + 'px';
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
                let initNum = 80;
                // found that 50 is the preset zoom of the rig.maincamera.zoom so I am using this as the base zoom
                const newZoom = initNum - (initNum - aspect * (initNum / 7));
                cameraRig.mainCamera.zoom = newZoom;
            }
        }
    }
}
