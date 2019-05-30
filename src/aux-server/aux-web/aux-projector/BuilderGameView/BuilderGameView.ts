import {
    Scene,
    Color,
    PerspectiveCamera,
    OrthographicCamera,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight,
    Math as ThreeMath,
    PCFSoftShadowMap,
    HemisphereLight,
    Plane,
    Vector3,
    GridHelper,
    Quaternion,
    Matrix4,
    Texture,
    Vector2,
    Camera,
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';

import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide } from 'vue-property-decorator';
import { SubscriptionLike } from 'rxjs';
import { concatMap, tap, flatMap as rxFlatMap } from 'rxjs/operators';

import {
    Object,
    DEFAULT_WORKSPACE_HEIGHT_INCREMENT,
    DEFAULT_USER_MODE,
    UserMode,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    AuxFile,
    getFileConfigContexts,
    hasValue,
    createContextId,
    AuxCausalTree,
    AuxOp,
    createWorkspace,
    FilesState,
    duplicateFile,
    toast,
    createCalculationContext,
    cleanFile,
} from '@casual-simulation/aux-common';
import { storedTree, StoredCausalTree } from '@casual-simulation/causal-trees';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';

import { appManager } from '../../shared/AppManager';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { flatMap, find, findIndex, debounce, keys } from 'lodash';
import BuilderApp from '../BuilderApp/BuilderApp';
import MiniFile from '../MiniFile/MiniFile';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/vue-components/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import BuilderHome from '../BuilderHome/BuilderHome';
import TrashCan from '../TrashCan/TrashCan';
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
} from '../../shared/scene/SceneUtils';
import { Physics } from '../../shared/scene/Physics';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../scene/BuilderSimulation3D';
import { HtmlMixer } from '../../shared/scene/HtmlMixer';
import { copyToClipboard } from '../../shared/SharedUtils';
import { Viewport } from '../../shared/scene/Viewport';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';
import { EventBus } from '../../shared/EventBus';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { BaseInteractionManager } from 'aux-web/shared/interaction/BaseInteractionManager';

@Component({
    extends: BaseGameView,
    components: {
        'mini-file': MiniFile,
        'trash-can': TrashCan,
    },
})
export default class BuilderGameView extends BaseGameView {
    private gridMesh: GridHelper;

    simulation3D: BuilderSimulation3D = null;
    mode: UserMode = DEFAULT_USER_MODE;
    showTrashCan: boolean = false;
    showUploadFiles: boolean = false;

    @Inject() addSidebarItem: BuilderApp['addSidebarItem'];
    @Inject() removeSidebarItem: BuilderApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: BuilderApp['removeSidebarGroup'];

    // TODO: Find a better way to refactor this
    @Inject() home: BuilderHome;

    get filesMode() {
        return this.mode === 'files';
    }
    get workspacesMode() {
        return this.mode === 'worksurfaces';
    }

    protected async onBeforeMountedComplete() {
        this.gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

        this.simulation3D = new BuilderSimulation3D(
            this,
            appManager.simulationManager.primary
        );

        this.simulation3D.init();
        this.simulation3D.onFileAdded.addListener(obj =>
            this.onFileAdded.invoke(obj)
        );
        this.simulation3D.onFileRemoved.addListener(obj =>
            this.onFileRemoved.invoke(obj)
        );
        this.simulation3D.onFileUpdated.addListener(obj =>
            this.onFileUpdated.invoke(obj)
        );
    }

    findFilesById(id: string): AuxFile3D[] {
        return flatMap(this.simulation3D.contexts, c =>
            c.getFiles().filter(f => f.file.id === id)
        );
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

    getViewports(): Viewport[] {
        return [this.mainViewport];
    }
    getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig];
    }
    getSimulations(): Simulation3D[] {
        return [this.simulation3D];
    }
    getBackground(): Color | Texture {
        return this.simulation3D.backgroundColor;
    }
    getUIHtmlElements(): HTMLElement[] {
        return [
            ...this.home.getUIHtmlElements(),
            <HTMLElement>this.$refs.fileQueue,
            this.$refs.trashCan ? (<TrashCan>this.$refs.trashCan).$el : null,
        ].filter(el => el);
    }

    setGridsVisible(visible: boolean) {
        this.simulation3D.contexts.forEach((c: BuilderGroup3D) => {
            if (c.surface) {
                c.surface.gridsVisible = visible;
            }
        });
    }

    setWorldGridVisible(visible: boolean) {
        this.gridMesh.visible = visible;
    }

    setupInteraction(): BaseInteractionManager {
        return new BuilderInteractionManager(this);
    }

    onDragEnter(event: DragEvent) {
        if (event.dataTransfer.types.indexOf('Files') >= 0) {
            this.showUploadFiles = true;
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
        }
    }

    onDragOver(event: DragEvent) {
        if (event.dataTransfer.types.indexOf('Files') >= 0) {
            this.showUploadFiles = true;
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
        }
    }

    onDragLeave(event: DragEvent) {
        this.showUploadFiles = false;
    }

    async onDrop(event: DragEvent) {
        this.showUploadFiles = false;
        event.preventDefault();
        let auxFiles: File[] = [];
        if (event.dataTransfer.items) {
            for (let i = 0; i < event.dataTransfer.items.length; i++) {
                const item = event.dataTransfer.items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file.name.endsWith('.aux')) {
                        auxFiles.push(file);
                    }
                }
            }
        } else {
            for (let i = 0; i < event.dataTransfer.files.length; i++) {
                const file = event.dataTransfer.files.item(i);
                if (file.name.endsWith('.aux')) {
                    auxFiles.push(file);
                }
            }
        }

        if (auxFiles.length > 0) {
            console.log(
                `[BuilderGameView] Uploading ${auxFiles.length} ${
                    auxFiles.length === 1 ? 'file' : 'files'
                }`
            );
            await Promise.all(
                auxFiles.map(file => appManager.uploadState(file))
            );
        }
    }

    copySelectionMac() {
        if (this.isMac()) {
            this._copySelection();
        }
    }

    copySelectionNormal() {
        if (!this.isMac()) {
            this._copySelection();
        }
    }

    pasteClipboardMac() {
        if (this.isMac()) {
            this._pasteClipboard();
        }
    }

    pasteClipboardNormal() {
        if (!this.isMac()) {
            this._pasteClipboard();
        }
    }

    private async _copySelection() {
        const sim = appManager.simulationManager.primary;
        const files = sim.selection.getSelectedFilesForUser(
            sim.helper.userFile
        );
        if (files.length === 0) {
            appManager.simulationManager.primary.helper.transaction(
                toast('Nothing selected to copy!')
            );
            return;
        }

        await appManager.copyFilesFromSimulation(sim, files);

        appManager.simulationManager.primary.helper.transaction(
            toast('Selection Copied!')
        );
    }

    private async _pasteClipboard() {
        if (navigator.clipboard) {
            try {
                // TODO: Cleanup this function
                const json = await navigator.clipboard.readText();
                const stored: StoredCausalTree<AuxOp> = JSON.parse(json);
                let tree = new AuxCausalTree(stored);
                await tree.import(stored);

                const value = tree.value;
                const fileIds = keys(value);
                let state: FilesState = {};

                const oldFiles = fileIds.map(id => value[id]);
                const calc = createCalculationContext(
                    oldFiles,
                    appManager.simulationManager.primary.helper.userFile.id,
                    appManager.simulationManager.primary.helper.lib
                );
                const oldWorksurface =
                    oldFiles.find(
                        f => getFileConfigContexts(calc, f).length > 0
                    ) || createWorkspace();
                const oldContexts = getFileConfigContexts(calc, oldWorksurface);

                const contextMap: Map<string, string> = new Map();
                let newContexts: string[] = [];
                oldContexts.forEach(c => {
                    const context = createContextId();
                    newContexts.push(context);
                    contextMap.set(c, context);
                });

                let worksurface = duplicateFile(oldWorksurface);

                oldContexts.forEach(c => {
                    let newContext = contextMap.get(c);
                    worksurface.tags[c] = null;
                    worksurface.tags['aux.context'] = newContext;
                    worksurface.tags['aux.context.surface'] = true;
                    worksurface.tags[newContext] = true;
                });

                worksurface = cleanFile(worksurface);

                const mouseDir = Physics.screenPosToRay(
                    this.getInput().getMouseScreenPos(),
                    this.mainCameraRig.mainCamera
                );
                const point = Physics.pointOnPlane(
                    mouseDir,
                    new Plane(new Vector3(0, 1, 0))
                );

                worksurface.tags['aux.context.surface.x'] = point.x;
                worksurface.tags['aux.context.surface.y'] = point.z;
                worksurface.tags['aux.context.surface.z'] = point.y;

                state[worksurface.id] = worksurface;

                for (let i = 0; i < fileIds.length; i++) {
                    const file = value[fileIds[i]];

                    if (file.id === oldWorksurface.id) {
                        continue;
                    }

                    let newFile = duplicateFile(file);

                    oldContexts.forEach(c => {
                        let newContext = contextMap.get(c);
                        newFile.tags[c] = null;

                        let x = file.tags[`${c}.x`];
                        let y = file.tags[`${c}.y`];
                        let z = file.tags[`${c}.z`];
                        let index = file.tags[`${c}.index`];
                        newFile.tags[`${c}.x`] = null;
                        newFile.tags[`${c}.y`] = null;
                        newFile.tags[`${c}.z`] = null;
                        newFile.tags[`${c}.index`] = null;

                        newFile.tags[newContext] = true;
                        newFile.tags[`${newContext}.x`] = x;
                        newFile.tags[`${newContext}.y`] = y;
                        newFile.tags[`${newContext}.z`] = z;
                        newFile.tags[`${newContext}.index`] = index;
                    });

                    state[newFile.id] = cleanFile(newFile);
                }

                await appManager.simulationManager.primary.helper.addState(
                    state
                );
                appManager.simulationManager.primary.helper.transaction(
                    toast(
                        `${fileIds.length} ${
                            fileIds.length === 1 ? 'file' : 'files'
                        } pasted!`
                    )
                );
            } catch (ex) {
                console.error('[BuilderGameView] Paste failed', ex);
                appManager.simulationManager.primary.helper.transaction(
                    toast(
                        "Couldn't paste your clipboard. Have you copied a selection or worksurface?"
                    )
                );
            }
        } else {
            console.error(
                "[BuilderGameView] Browser doesn't support clipboard API!"
            );
            appManager.simulationManager.primary.helper.transaction(
                toast(
                    "Sorry, but your browser doesn't support pasting files from a selection or worksurface."
                )
            );
        }
    }

    protected renderCore(): void {
        super.renderCore();
        //
        // [Main scene]
        //

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Set the background color to null when rendering with the ui world camera.
        this.mainScene.background = null;

        // Render the main scene with the ui world camera.
        this.renderer.clearDepth(); // Clear depth buffer so that ui world appears above objects that were just rendererd.
        this.renderer.render(this.mainScene, this.mainCameraRig.uiWorldCamera);

        this.mainSceneBackgroundUpdate();
    }

    protected setupScenes() {
        super.setupScenes();

        // Main scene grid plane.
        this.gridMesh = new GridHelper(1000, 300, 0xbbbbbb, 0xbbbbbb);
        this.gridMesh.visible = false;
        this.mainScene.add(this.gridMesh);

        // Main scene simulations.
        this.mainScene.add(this.simulation3D);
    }
}
