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
import App from '../App/App';
import MiniFile from '../MiniFile/MiniFile';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import Home from '../Home/Home';
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

@Component({
    components: {
        'mini-file': MiniFile,
        'trash-can': TrashCan,
        'camera-type': CameraTypeVue,
        'camera-home': CameraHome,
    },
})
export default class GameView extends Vue implements IGameView {
    private _mainScene: Scene;
    private _mainViewport: Viewport;
    private _renderer: WebGLRenderer;

    private _enterVr: any;
    private _vrControls: any;
    private _vrEffect: any;

    private _gridMesh: GridHelper;
    private _time: Time;
    private _input: Input;
    private _inputVR: InputVR;
    private _interaction: BuilderInteractionManager;
    private _gridChecker: GridChecker;
    private _sceneBackground: Color | Texture;
    private _cameraType: CameraType;
    private _htmlMixerContext: HtmlMixer.Context;

    public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onCameraRigTypeChanged: ArgEvent<CameraRig> = new ArgEvent<
        CameraRig
    >();

    // private _contexts: BuilderGroup3D[];
    private _subs: SubscriptionLike[];
    private _decoratorFactory: AuxFile3DDecoratorFactory;

    simulation3D: BuilderSimulation3D = null;
    mainCameraRig: CameraRig = null;
    mode: UserMode = DEFAULT_USER_MODE;
    xrCapable: boolean = false;
    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;
    vrDisplay: VRDisplay = null;
    vrCapable: boolean = false;
    showTrashCan: boolean = false;
    showUploadFiles: boolean = false;

    @Inject() addSidebarItem: App['addSidebarItem'];
    @Inject() removeSidebarItem: App['removeSidebarItem'];

    // TODO: Find a better way to refactor this
    @Inject() home: Home;
    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }
    get dev() {
        return !PRODUCTION;
    }
    get filesMode() {
        return this.mode === 'files';
    }
    get workspacesMode() {
        return this.mode === 'worksurfaces';
    }
    // get fileManager() {
    //     return appManager.simulationManager.primary;
    // }

    constructor() {
        super();
    }

    public findFilesById(id: string): AuxFile3D[] {
        return flatMap(this.simulation3D.contexts, c =>
            c.getFiles().filter(f => f.file.id === id)
        );
    }

    public getTime() {
        return this._time;
    }
    public getInput() {
        return this._input;
    }
    public getInputVR() {
        return this._inputVR;
    }
    public getInteraction() {
        return this._interaction;
    }
    public getScene() {
        return this._mainScene;
    }
    public getRenderer() {
        return this._renderer;
    }
    public getGridChecker() {
        return this._gridChecker;
    }
    public getMainCameraRig(): CameraRig {
        return this.mainCameraRig;
    }
    public getMainViewport(): Viewport {
        return this._mainViewport;
    }
    public getDecoratorFactory(): AuxFile3DDecoratorFactory {
        return this._decoratorFactory;
    }
    public getViewports(): Viewport[] {
        return [this._mainViewport];
    }
    public getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig];
    }

    public getSimulations(): Simulation3D[] {
        return [this.simulation3D];
    }

    public getUIHtmlElements(): HTMLElement[] {
        return [
            ...this.home.getUIHtmlElements(),
            <HTMLElement>this.$refs.fileQueue,
            this.$refs.trashCan ? (<TrashCan>this.$refs.trashCan).$el : null,
        ].filter(el => el);
    }

    public getHtmlMixerContext(): HtmlMixer.Context {
        return this._htmlMixerContext;
    }

    public setGridsVisible(visible: boolean) {
        this.simulation3D.contexts.forEach((c: BuilderGroup3D) => {
            if (c.surface) {
                c.surface.gridsVisible = visible;
            }
        });
    }

    public setWorldGridVisible(visible: boolean) {
        this._gridMesh.visible = visible;
    }

    public setCameraType(type: CameraType) {
        if (this._cameraType === type) return;

        // Clean up current cameras if they exists.
        if (this.mainCameraRig) {
            this._mainScene.remove(this.mainCameraRig.mainCamera);
            this.mainCameraRig = null;
        }

        this._cameraType = type;

        this.mainCameraRig = createCameraRig(
            'main',
            this._cameraType,
            this._mainScene,
            this._mainViewport
        );

        // Update side bar item.
        this.removeSidebarItem('toggle_camera_type');
        if (this._cameraType === 'orthographic') {
            this.addSidebarItem(
                'toggle_camera_type',
                'Enable Perspective Camera',
                () => {
                    this.setCameraType('perspective');
                },
                'videocam'
            );
        } else {
            this.addSidebarItem(
                'toggle_camera_type',
                'Disable Perspective Camera',
                () => {
                    this.setCameraType('orthographic');
                },
                'videocam_off'
            );
        }

        if (this._htmlMixerContext) {
            this._htmlMixerContext.setupCssCamera(
                this.mainCameraRig.mainCamera
            );
        }

        this.onCameraRigTypeChanged.invoke(this.mainCameraRig);
    }

    public tweenCameraToFile(
        cameraRig: CameraRig,
        fileId: string,
        zoomValue?: number
    ) {
        console.log('[GameView] Tween to file: ', fileId);

        // find the file with the given ID
        const files = this.findFilesById(fileId);
        if (files.length > 0) {
            const file = files[0];
            const targetPosition = new Vector3();
            file.display.getWorldPosition(targetPosition);

            this.tweenCameraToPosition(cameraRig, targetPosition, zoomValue);
        }
    }

    public tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number
    ) {
        this._interaction.addOperation(
            new TweenCameraToOperation(
                cameraRig,
                this._interaction,
                position,
                zoomValue
            )
        );
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
                `[GameView] Uploading ${auxFiles.length} ${
                    auxFiles.length === 1 ? 'file' : 'files'
                }`
            );
            await Promise.all(
                auxFiles.map(file => appManager.uploadState(file))
            );
        }
    }

    onCenterCamera(cameraRig: CameraRig): void {
        if (!cameraRig) return;
        this.tweenCameraToPosition(cameraRig, new Vector3(0, 0, 0));
    }

    copySelectionMac() {
        if (this._isMac()) {
            this._copySelection();
        }
    }

    copySelectionNormal() {
        if (!this._isMac()) {
            this._copySelection();
        }
    }

    pasteClipboardMac() {
        if (this._isMac()) {
            this._pasteClipboard();
        }
    }

    pasteClipboardNormal() {
        if (!this._isMac()) {
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
                console.error('[GameView] Paste failed', ex);
                appManager.simulationManager.primary.helper.transaction(
                    toast(
                        "Couldn't paste your clipboard. Have you copied a selection or worksurface?"
                    )
                );
            }
        } else {
            console.error("[GameView] Browser doesn't support clipboard API!");
            appManager.simulationManager.primary.helper.transaction(
                toast(
                    "Sorry, but your browser doesn't support pasting files from a selection or worksurface."
                )
            );
        }
    }

    private _isMac(): boolean {
        return /(Mac)/i.test(navigator.platform);
    }

    public async mounted() {
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('vrdisplaypresentchange', this._handleResize);

        this._time = new Time();
        this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this._subs = [];
        this.simulation3D = new BuilderSimulation3D(
            this,
            appManager.simulationManager.primary
        );
        this._setupRenderer();
        this._setupScenes();
        DebugObjectManager.init(this._time, this._mainScene);
        this._input = new Input(this);
        this._inputVR = new InputVR(this);
        this._interaction = new BuilderInteractionManager(this);
        this._gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

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

        this._setupWebVR();
        await this._setupWebXR();
        this._handleResize();
        this._frameUpdate();

        EventBus.$on('centerCamera', this.onCenterCamera);
        EventBus.$on('changeCameraType', this.setCameraType);
    }

    public beforeDestroy() {
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener(
            'vrdisplaypresentchange',
            this._handleResize
        );
        this.removeSidebarItem('enable_xr');
        this.removeSidebarItem('disable_xr');
        this._input.dispose();

        if (this._subs) {
            this._subs.forEach(sub => {
                sub.unsubscribe();
            });
            this._subs = [];
        }

        EventBus.$off('centerCamera', this.onCenterCamera);
        EventBus.$off('changeCameraType', this.setCameraType);
    }

    private _frameUpdate(xrFrame?: any) {
        DebugObjectManager.update();

        this._input.update();
        this._inputVR.update();
        this._interaction.update();

        this.simulation3D.frameUpdate();

        if (this._htmlMixerContext) {
            this._htmlMixerContext.update();
        }
        this._cameraUpdate();
        this._renderUpdate(xrFrame);
        this._time.update();

        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this.vrDisplay.requestAnimationFrame(() => this._frameUpdate());
        } else if (this.xrSession) {
            this.xrSession.requestFrame((nextXRFrame: any) =>
                this._frameUpdate(nextXRFrame)
            );
        } else {
            requestAnimationFrame(() => this._frameUpdate());
        }
    }

    private _cameraUpdate() {
        // Keep camera zoom levels in sync.
        if (
            this.mainCameraRig.uiWorldCamera.zoom !==
            this.mainCameraRig.mainCamera.zoom
        ) {
            this.mainCameraRig.uiWorldCamera.zoom = this.mainCameraRig.mainCamera.zoom;
            this.mainCameraRig.uiWorldCamera.updateProjectionMatrix();
        }
    }

    private _renderUpdate(xrFrame?: any) {
        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this._vrControls.update();
            this._renderCore();
            this._vrEffect.render(this._mainScene, this.mainCameraRig);
        } else if (this.xrSession && xrFrame) {
            this._mainScene.background = null;
            this._renderer.setSize(
                this.xrSession.baseLayer.framebufferWidth,
                this.xrSession.baseLayer.framebufferHeight,
                false
            );
            this._renderer.setClearColor('#000', 0);

            this.mainCameraRig.mainCamera.matrixAutoUpdate = false;

            for (const view of xrFrame.views) {
                // Each XRView has its own projection matrix, so set the _camera to use that
                let matrix = new Matrix4();
                matrix.fromArray(view.viewMatrix);

                let position = new Vector3();
                position.setFromMatrixPosition(matrix);
                position.multiplyScalar(10);

                // Move the player up about a foot above the world.
                position.add(new Vector3(0, 2, 3));
                this.mainCameraRig.mainCamera.position.copy(position);

                let rotation = new Quaternion();
                rotation.setFromRotationMatrix(matrix);
                this.mainCameraRig.mainCamera.setRotationFromQuaternion(
                    rotation
                );

                this.mainCameraRig.mainCamera.updateMatrix();
                this.mainCameraRig.mainCamera.updateMatrixWorld(false);

                this.mainCameraRig.mainCamera.projectionMatrix.fromArray(
                    view.projectionMatrix
                );

                // Set up the _renderer to the XRView's viewport and then render
                const viewport = view.getViewport(this.xrSession.baseLayer);
                this._renderer.setViewport(
                    viewport.x,
                    viewport.y,
                    viewport.width,
                    viewport.height
                );

                this._renderCore();
            }
        } else {
            this.mainCameraRig.mainCamera.matrixAutoUpdate = true;
            this._renderCore();
        }
    }

    private _renderCore(): void {
        //
        // [Main scene]
        //

        // Render the main scene with the main camera.
        this._renderer.clear();
        this._renderer.render(this._mainScene, this.mainCameraRig.mainCamera);

        // Set the background color to null when rendering with the ui world camera.
        this._mainScene.background = null;

        // Render the main scene with the ui world camera.
        this._renderer.clearDepth(); // Clear depth buffer so that ui world appears above objects that were just rendererd.
        this._renderer.render(
            this._mainScene,
            this.mainCameraRig.uiWorldCamera
        );

        this._mainSceneBackgroundUpdate();
    }

    private _mainSceneBackgroundUpdate() {
        if (this._sceneBackground) {
            this._mainScene.background = this._sceneBackground;
        } else {
            this._mainScene.background = new Color(
                DEFAULT_SCENE_BACKGROUND_COLOR
            );
        }
    }

    private _setupRenderer() {
        const webGlRenderer = (this._renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;
        webGlRenderer.shadowMap.enabled = false;

        this._mainViewport = new Viewport('main', null, this._container);

        this.gameView.appendChild(this._renderer.domElement);
    }

    private _setupScenes() {
        //
        // [Main scene]
        //
        this._mainScene = new Scene();

        let globalsFile = this.simulation3D.simulation.helper.globalsFile;

        // Main scene background color.
        let sceneBackgroundColor = globalsFile.tags['aux.scene.color'];
        this._sceneBackground = hasValue(sceneBackgroundColor)
            ? new Color(sceneBackgroundColor)
            : new Color('#263238');
        this._mainSceneBackgroundUpdate();
        this.setCameraType('orthographic');

        // Main scene ambient light.
        const ambient = baseAuxAmbientLight();
        this._mainScene.add(ambient);

        // Main scene directional light.
        const directional = baseAuxDirectionalLight();
        this._mainScene.add(directional);

        // Main scene grid plane.
        this._gridMesh = new GridHelper(1000, 300, 0xbbbbbb, 0xbbbbbb);
        this._gridMesh.visible = false;
        this._mainScene.add(this._gridMesh);

        // Main scene simulations.
        this._mainScene.add(this.simulation3D);

        //
        // [Html Mixer Context]
        //
        this._htmlMixerContext = createHtmlMixerContext(
            this._renderer,
            this.mainCameraRig.mainCamera,
            this.gameView
        );
    }

    private _setupWebVR() {
        let onBeforeEnter = () => {
            console.log('[GameView] vr on before enter');

            this._renderer.vr.enabled = true;

            // VR controls
            this._vrControls = new VRControlsModule(this.mainCameraRig);
            this._vrControls.standing = true;

            // Create VR Effect rendering in stereoscopic mode
            this._vrEffect = new VREffectModule(this._renderer);
            this._renderer.setPixelRatio(window.devicePixelRatio);

            return new Promise((resolve, reject) => {
                resolve(null);
            });
        };

        this.vrDisplay = null;

        // WebVR enable button.
        let vrButtonOptions = {
            color: 'black',
            beforeEnter: onBeforeEnter,
        };

        this._enterVr = new webvrui.EnterVRButton(
            this._renderer.domElement,
            vrButtonOptions
        );

        // Event handlers for the vr button.
        this._handleReadyVR = this._handleReadyVR.bind(this);
        this._handleEnterVR = this._handleEnterVR.bind(this);
        this._handleExitVR = this._handleExitVR.bind(this);
        this._handleErrorVR = this._handleErrorVR.bind(this);

        this._enterVr.on('ready', this._handleReadyVR);
        this._enterVr.on('enter', this._handleEnterVR);
        this._enterVr.on('exit', this._handleExitVR);
        this._enterVr.on('error', this._handleErrorVR);

        let vrButtonContainer = document.getElementById('vr-button-container');
        vrButtonContainer.appendChild(this._enterVr.domElement);
    }

    // TODO: All this needs to be reworked to use the right WebXR polyfill
    // - Use this one: https://github.com/immersive-web/webxr-polyfill
    // - instead of this one: https://github.com/mozilla/webxr-polyfill

    private async _setupWebXR() {
        const win = <any>window;
        const navigator = <any>win.navigator;
        const xr = navigator.XR;

        if (typeof xr === 'undefined') {
            console.log('[GameView] WebXR Not Supported.');
            return;
        }

        const displays = await xr.getDisplays();
        this.xrSessionInitParameters = {
            exclusive: false,
            type: win.XRSession.AUGMENTATION,
            videoFrames: false, //computer_vision_data
            alignEUS: true,
            worldSensing: false,
        };
        const matchingDisplay = find(displays, d =>
            d.supportsSession(this.xrSessionInitParameters)
        );
        if (matchingDisplay && this._isRealAR(matchingDisplay)) {
            this.xrCapable = true;
            this.xrDisplay = matchingDisplay;
            this.addSidebarItem('enable_xr', 'Enable AR', () => {
                this.toggleXR();
            });
            console.log('[GameView] WebXR Supported!');
        }
    }

    async toggleXR() {
        console.log('toggle XR');
        if (this.xrDisplay) {
            if (this.xrSession) {
                this.removeSidebarItem('disable_xr');
                this.addSidebarItem('enable_xr', 'Enable AR', () => {
                    this.toggleXR();
                });

                await this.xrSession.end();
                this.xrSession = null;
                document.documentElement.classList.remove('ar-app');
            } else {
                this.removeSidebarItem('enable_xr');
                this.addSidebarItem('disable_xr', 'Disable AR', () => {
                    this.toggleXR();
                });

                document.documentElement.classList.add('ar-app');
                this.xrSession = await this.xrDisplay.requestSession(
                    this.xrSessionInitParameters
                );
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) =>
                    this._handleXRSessionFocus(ev)
                );
                this.xrSession.addEventListener('blur', (ev: any) =>
                    this._handleXRSessionBlur(ev)
                );
                this.xrSession.addEventListener('end', (ev: any) =>
                    this._handleXRSessionEnded(ev)
                );

                this._startXR();

                setTimeout(() => {
                    this._handleResize();
                }, 1000);
            }
        }
    }

    private _startXR() {
        const win = <any>window;
        const navigator = win.navigator;
        if (this.xrSession === null) {
            throw new Error('Can not start presenting without a xrSession');
        }

        // Set the xrSession's base layer into which the app will render
        this.xrSession.baseLayer = new win.XRWebGLLayer(
            this.xrSession,
            this._renderer.context
        );

        // Handle layer focus events
        this.xrSession.baseLayer.addEventListener('focus', (ev: any) => {
            this._handleXRLayerFocus(ev);
        });
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => {
            this._handleXRLayerBlur(ev);
        });

        // this.xrSession.requestFrame(this._boundHandleFrame)
    }

    private _handleXRSessionFocus(event: any) {}

    private _handleXRSessionBlur(event: any) {}

    private _handleXRSessionEnded(event: any) {}

    private _handleXRLayerFocus(event: any) {}

    private _handleXRLayerBlur(event: any) {}

    private _isRealAR(xrDisplay: any): boolean {
        // The worst hack of all time.
        // Basically does the check that the webxr polyfill does
        // to see it the device really supports Web XR.
        return (
            typeof (<any>window).webkit !== 'undefined' ||
            xrDisplay._reality._vrDisplay
        );
    }

    private _handleReadyVR(display: VRDisplay) {
        console.log('[GameView] vr display is ready.');
        console.log(display);
        this.vrDisplay = display;

        // When being used on a vr headset, force the normal input module to use touch instead of mouse.
        // Touch seems to work better for 2d browsers on vr headsets (like the Oculus Go).
        this._input.currentInputType = InputType.Touch;
    }

    private _handleEnterVR(display: any) {
        console.log('[GameView] enter vr.');
        console.log(display);
        this.vrDisplay = display;
    }

    private _handleExitVR(display: any) {
        console.log('[GameView] exit vr.');
        console.log(display);

        this._renderer.vr.enabled = false;

        this._inputVR.disconnectControllers();

        this._vrControls.dispose();
        this._vrControls = null;

        this._vrEffect.dispose();
        this._vrEffect = null;

        // reset camera back to default position.
        this.mainCameraRig.mainCamera.position.z = 5;
        this.mainCameraRig.mainCamera.position.y = 3;
        this.mainCameraRig.mainCamera.rotation.x = ThreeMath.degToRad(-30);
        this.mainCameraRig.mainCamera.updateMatrixWorld(false);
    }

    private _handleErrorVR(error: any) {
        // console.error('error vr');
        // console.error(error);
    }

    private _handleResize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this._container.getBoundingClientRect().top;

        this._mainViewport.setSize(width, height);

        // Resize html view and the webgl renderer.
        this._renderer.setPixelRatio(window.devicePixelRatio || 1);
        this._renderer.setSize(width, height);
        this._container.style.height = this.gameView.style.height = this._renderer.domElement.style.height;
        this._container.style.width = this.gameView.style.width = this._renderer.domElement.style.width;

        // Resize html mixer css3d renderer.
        if (this._htmlMixerContext) {
            this._htmlMixerContext.rendererCss.setSize(width, height);
        }

        // Resize cameras.
        if (this.mainCameraRig) {
            resizeCameraRig(this.mainCameraRig);
        }

        // Resize VR effect.
        if (this._vrEffect) {
            const vrWidth = window.innerWidth;
            const vrHeight = window.innerHeight;
            this._vrEffect.setSize(vrWidth, vrHeight);
        }
    }

    private get _container() {
        return <HTMLElement>this.$refs.container;
    }
}
