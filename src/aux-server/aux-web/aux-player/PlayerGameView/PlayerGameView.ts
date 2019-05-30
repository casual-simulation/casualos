import {
    Scene,
    Color,
    PerspectiveCamera,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight,
    Math as ThreeMath,
    PCFSoftShadowMap,
    HemisphereLight,
    Plane,
    Vector3,
    Quaternion,
    Matrix4,
    Texture,
    OrthographicCamera,
    MeshToonMaterial,
    Mesh,
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';

import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide, Prop, Watch } from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';

import {
    Object,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    AuxFile,
    AuxObject,
    hasValue,
    getFilesStateFromStoredTree,
} from '@casual-simulation/aux-common';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';
import { appManager } from '../../shared/AppManager';
import { find, flatMap, uniqBy } from 'lodash';
import PlayerApp from '../PlayerApp/PlayerApp';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/vue-components/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import MenuFile from '../MenuFile/MenuFile';
import {
    CameraType,
    resizeCameraRig,
    createCameraRig,
    CameraRig,
} from '../../shared/scene/CameraRigFactory';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
    createHtmlMixerContext,
    createCube,
    createSphere,
} from '../../shared/scene/SceneUtils';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { Simulation } from '../../shared/Simulation';
import { MenuItem } from '../MenuContext';
import SimulationItem from '../SimulationContext';
import { HtmlMixer } from '../../shared/scene/HtmlMixer';
import { InventorySimulation3D } from '../scene/InventorySimulation3D';
import { Viewport } from '../../shared/scene/Viewport';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import { EventBus } from '../../shared/EventBus';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { BaseInteractionManager } from 'aux-web/shared/interaction/BaseInteractionManager';

@Component({
    extends: BaseGameView,
    components: {
        'menu-file': MenuFile,
    },
})
export default class PlayerGameView extends BaseGameView {
    private inventoryScene: Scene;

    private playerSimulations: PlayerSimulation3D[] = [];
    private inventorySimulations: InventorySimulation3D[] = [];

    inventoryCameraRig: CameraRig = null;
    inventoryViewport: Viewport = null;

    menuExpanded: boolean = true;

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];
    @Prop() context: string;

    get filesMode(): boolean {
        console.error('AUX Player does not implement filesMode.');
        return false;
    }
    get workspacesMode(): boolean {
        console.error('AUX Player does not implement workspacesMode.');
        return false;
    }
    get menu() {
        let items: MenuItem[] = [];
        this.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });
        return items;
    }

    findFilesById(id: string): AuxFile3D[] {
        return flatMap(flatMap(this.playerSimulations, s => s.contexts), c =>
            c.getFiles().filter(f => f.file.id === id)
        );
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

    baseAddSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void {
        this.addSidebarItem(id, text, click, icon, group);
    }

    baseRemoveSidebarItem(id: string): void {
        this.removeSidebarItem(id);
    }

    baseRemoveSidebarGroup(group: string): void {
        this.removeSidebarGroup(group);
    }

    getInventoryViewport(): Viewport {
        return this.inventoryViewport;
    }
    getInventoryCameraRig(): CameraRig {
        return this.inventoryCameraRig;
    }
    getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.inventory];
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
    getBackground(): Color | Texture {
        for (let i = 0; i < this.playerSimulations.length; i++) {
            const sim = this.playerSimulations[i];
            if (sim.backgroundColor) {
                return sim.backgroundColor;
            }
        }

        return null;
    }

    setGridsVisible(visible: boolean) {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }

    setWorldGridVisible(visible: boolean) {}

    setupInteraction(): BaseInteractionManager {
        return new PlayerInteractionManager(this);
    }

    protected async onBeforeMountedComplete() {
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

    protected onBeforeDestroyComplete() {
        this.removeSidebarItem('debug_mode');
        this.removeSidebarGroup('simulations');
    }

    private simulationAdded(sim: Simulation) {
        const playerSim3D = new PlayerSimulation3D(this.context, this, sim);
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

    private async importAUX(sim: Simulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getFilesStateFromStoredTree(stored);
        await sim.helper.addState(state);
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

    onCenterCamera(cameraRig: CameraRig): void {
        if (!cameraRig) return;
        this.tweenCameraToPosition(cameraRig, new Vector3(0, 0, 0));
    }

    tweenCameraToFile(
        cameraRig: CameraRig,
        fileId: string,
        zoomValue?: number
    ) {
        console.log('[PlayerGameView] Tween to file: ', fileId);

        // find the file with the given ID
        const files = this.findFilesById(fileId);
        if (files.length > 0) {
            const file = files[0];
            const targetPosition = new Vector3();
            file.display.getWorldPosition(targetPosition);

            this.tweenCameraToPosition(cameraRig, targetPosition, zoomValue);
        }
    }

    tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number
    ) {
        this.interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this.interaction,
                position,
                zoomValue
            )
        );
    }

    protected renderCore(): void {
        super.renderCore();

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

        this.inventoryScene.background = null;

        // Render the inventory scene with the inventory ui world camera.
        this.renderer.clearDepth(); // Clear depth buffer so that ui objects dont use it.
        this.renderer.render(
            this.inventoryScene,
            this.inventoryCameraRig.uiWorldCamera
        );
    }

    private inventorySceneBackgroundUpdate(colorToOffset: Color) {
        if (!colorToOffset) return;

        let invColor = colorToOffset.clone();
        invColor.offsetHSL(0, -0.02, -0.04);
        this.inventoryScene.background = invColor;
    }

    protected setupRenderer() {
        super.setupRenderer();

        this.inventoryViewport = new Viewport('inventory', this.mainViewport);
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

    protected handleResize() {
        super.handleResize();

        const { width, height } = this.calculateContainerSize();

        const invHeightScale = height < 850 ? 0.25 : 0.2;
        this.inventoryViewport.setScale(null, invHeightScale);

        if (this.inventoryCameraRig) {
            resizeCameraRig(this.inventoryCameraRig);
        }
    }
}
