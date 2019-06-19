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
import { tap } from 'rxjs/operators';
import { flatMap } from 'lodash';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import { Simulation } from '@casual-simulation/aux-vm';
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

    startZoom: number;
    startAspect: number;

    private inventoryScene: Scene;

    inventoryHeightOverride: number = null;

    private slider: Element;
    private sliderVis: Element;
    private sliderPressed: boolean = false;

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
    findInventorySimulation3D(sim: Simulation): InventorySimulation3D {
        return this.inventorySimulations.find(s => s.simulation === sim);
    }

    /**
     * Find Player Simulation 3D object that is displaying for the given Simulation.
     * @param sim The simulation to find a simulation 3d for.
     */
    findPlayerSimulation3D(sim: Simulation): PlayerSimulation3D {
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

    private simulationAdded(sim: Simulation) {
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
            playerSim3D.simulation.helper.localEvents.subscribe(e => {
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

    private simulationRemoved(sim: Simulation) {
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
            appManager.user.channelId,
            ...items.map(i => i.simulationToLoad),
        ]);
    }

    private async importAUX(sim: Simulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getFilesStateFromStoredTree(stored);
        await sim.helper.addState(state);
    }

    protected renderCore(): void {
        super.renderCore();

        if (!WebVRDisplays.isPresenting()) {
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
    }

    private inventorySceneBackgroundUpdate(colorToOffset: Color) {
        if (!colorToOffset) return;

        let invColor = colorToOffset.clone();
        let tagColor =
            appManager.simulationManager.primary.helper.globalsFile.tags[
                'aux.inventory.color'
            ];

        if (tagColor != undefined && tagColor.trim().length > 0) {
            invColor = new Color(tagColor);
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

        // Inventory camera.
        this.inventoryCameraRig = createCameraRig(
            'inventory',
            'orthographic',
            this.inventoryScene,
            this.inventoryViewport
        );
        this.inventoryCameraRig.mainCamera.zoom = 50;
        this.inventoryScene.add(this.inventoryCameraRig.mainCamera);

        // Inventory ambient light.
        const invAmbient = baseAuxAmbientLight();
        this.inventoryScene.add(invAmbient);

        // Inventory direction light.
        const invDirectional = baseAuxDirectionalLight();
        this.inventoryScene.add(invDirectional);
    }

    onWindowResize(width: number, height: number) {
        super.onWindowResize(width, height);

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
                invHeightScale = defaultHeight;
            }
        }

        // if there is no existing height set by the slider then
        if (this.inventoryHeightOverride === null) {
            // get a new reference to the slider object in the html
            this.slider = document.querySelector('.slider-hidden');
            this.sliderVis = document.querySelector('.slider-visible');

            this.inventoryViewport.setScale(null, invHeightScale);

            // set the new slider's top position to the top of the viewport
            (<HTMLElement>this.slider).style.top =
                (height - this.inventoryViewport.height - 20).toString() + 'px';
            (<HTMLElement>this.sliderVis).style.top =
                (height - this.inventoryViewport.height).toString() + 'px';

            this.inventoryHeightOverride =
                height -
                +(<HTMLElement>this.slider).style.top.replace('px', '');
        } else {
            invHeightScale = this.inventoryHeightOverride / height;
            this.inventoryViewport.setScale(null, invHeightScale);

            (<HTMLElement>this.slider).style.top =
                (height - this.inventoryViewport.height - 20).toString() + 'px';
            (<HTMLElement>this.sliderVis).style.top =
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
                this.inventoryViewport.height -
                20
            ).toString() + 'px';
    }

    frameUpdate() {
        super.frameUpdate();

        if (!this.sliderPressed) return false;

        let sliderPos = this.input.getMousePagePos().y;

        //prevent the slider from being positioned outside the window bounds
        if (sliderPos < 0) sliderPos = 0;
        if (sliderPos > window.innerHeight) sliderPos = window.innerHeight;

        (<HTMLElement>this.slider).style.top = sliderPos - 20 + 'px';

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
                // found that 50 is the preset zoom of the rig.maincamera.zoom so I am using this as the base zoom
                const newZoom = 50 - (49 - aspect * 7);
                cameraRig.mainCamera.zoom = newZoom;
            }
        }
    }
}
