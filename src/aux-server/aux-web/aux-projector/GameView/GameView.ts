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
    getUserMode,
    createFile,
    doFilesAppearEqual,
    AuxFile,
    getConfigTagContext,
    getFileConfigContexts,
    hasValue,
    createContextId,
    AuxCausalTree,
    AuxOp,
    createWorkspace,
    addToContextDiff,
    FilesState,
    duplicateFile,
    toast,
    isConfigForContext,
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
} from '../../shared/scene/CameraRigFactory';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
} from '../../shared/scene/SceneUtils';
import { Physics } from '../../shared/scene/Physics';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../scene/BuilderSimulation3D';
import { copyToClipboard } from '../../shared/SharedUtils';

@Component({
    components: {
        'mini-file': MiniFile,
        'trash-can': TrashCan,
    },
})
export default class GameView extends Vue implements IGameView {
    private _scene: Scene;
    private _mainCamera: OrthographicCamera | PerspectiveCamera;
    private _uiWorldCamera: OrthographicCamera | PerspectiveCamera;
    private _renderer: WebGLRenderer;

    private _enterVr: any;
    private _vrControls: any;
    private _vrEffect: any;

    private _directional: DirectionalLight;
    private _ambient: AmbientLight;

    private _groundPlane: Plane;
    private _gridMesh: GridHelper;
    private _canvas: HTMLCanvasElement;
    private _time: Time;
    private _input: Input;
    private _inputVR: InputVR;
    private _interaction: BuilderInteractionManager;
    private _gridChecker: GridChecker;
    private _sceneBackground: Color | Texture;
    private _cameraType: CameraType;

    showDialog: boolean = false;
    contextDialog: string = '';
    builderCheck: boolean = false;
    playerCheck: boolean = false;

    public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onCameraTypeChanged: ArgEvent<
        PerspectiveCamera | OrthographicCamera
    > = new ArgEvent<PerspectiveCamera | OrthographicCamera>();

    // private _contexts: BuilderGroup3D[];
    private _subs: SubscriptionLike[];
    private _decoratorFactory: AuxFile3DDecoratorFactory;

    simulation3D: BuilderSimulation3D = null;
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
    get canvas() {
        return this._canvas;
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

    /**
     * Click event from GameView.vue
     */
    private onConfirmDialogOk() {
        let contextType = '=isBuilder';

        if (this.playerCheck) {
            contextType = '=isBuilder || isPlayer';
        }

        this.simulation3D.simulation.helper.createWorkspace(
            undefined,
            this.contextDialog,
            contextType
        );

        this.showDialog = false;
    }

    /**
     * Click event from GameView.vue
     */
    private onConfirmDialogCancel() {
        this.showDialog = false;
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
    public getScene() {
        return this._scene;
    }
    public getRenderer() {
        return this._renderer;
    }
    public getGroundPlane() {
        return this._groundPlane;
    }
    public getGridChecker() {
        return this._gridChecker;
    }
    public getMainCamera(): PerspectiveCamera | OrthographicCamera {
        return this._mainCamera;
    }

    public getDecoratorFactory(): AuxFile3DDecoratorFactory {
        return this._decoratorFactory;
    }

    public getSimulations(): Simulation3D[] {
        return [this.simulation3D];
    }
    public getContexts() {
        return this.simulation3D.contexts.filter(c => c.contexts.size > 0);
    }

    public getUIHtmlElements(): HTMLElement[] {
        return [
            ...this.home.getUIHtmlElements(),
            <HTMLElement>this.$refs.fileQueue,
            this.$refs.trashCan ? (<TrashCan>this.$refs.trashCan).$el : null,
        ].filter(el => el);
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

    public addNewWorkspace(): void {
        this.contextDialog = createContextId();
        this.playerCheck = false;
        this.showDialog = true;
    }

    public setCameraType(type: CameraType) {
        if (this._cameraType === type) return;

        // Clean up current cameras if they exists.
        if (this._mainCamera) {
            this._scene.remove(this._mainCamera);
            this._mainCamera = null;
            this._uiWorldCamera = null;
        }

        this._cameraType = type;

        const { width, height } = this._calculateCameraSize();
        const rig = createCameraRig(
            this._cameraType,
            this._scene,
            width,
            height
        );

        this._mainCamera = rig.mainCamera;
        this._uiWorldCamera = rig.uiWorldCamera;

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

        this.onCameraTypeChanged.invoke(this._mainCamera);
    }

    /**
     * Animates the main camera into position to view the given file ID.
     * @param fileId The ID of the file to view.
     */
    public tweenCameraToFile(fileId: string, zoomValue: number) {
        console.log('[GameView] Tween to: ', fileId);

        // find the file with the given ID
        const files = this.findFilesById(fileId);
        if (files.length > 0) {
            const file = files[0];
            const targetPosition = new Vector3();
            file.display.getWorldPosition(targetPosition);
            this.tweenCameraToPosition(targetPosition);

            if (zoomValue >= 0) {
                const cam = this.getMainCamera();
                this._interaction.cameraControls.dollySet(zoomValue);
            }
        }
    }

    /**
     * Animates the main camera to the given position.
     * @param position The position to animate to.
     */
    public tweenCameraToPosition(position: Vector3) {
        this._interaction.addOperation(
            new TweenCameraToOperation(this, this._interaction, position)
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

    copySelection(event: any) {
        switch (event.srcKey) {
            case 'mac':
                if (this._isMac()) {
                    this._copySelection();
                }
                break;
            default:
                if (!this._isMac()) {
                    this._copySelection();
                }
                break;
        }
    }

    pasteClipboard(event: any) {
        switch (event.srcKey) {
            case 'mac':
                if (this._isMac()) {
                    this._pasteClipboard();
                }
                break;
            default:
                if (!this._isMac()) {
                    this._pasteClipboard();
                }
                break;
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
                    let config = oldWorksurface.tags[`${c}.config`];
                    worksurface.tags[c] = null;
                    worksurface.tags[`${c}.config`] = null;
                    worksurface.tags[newContext] = true;
                    worksurface.tags[`${newContext}.config`] = config;
                });

                worksurface = cleanFile(worksurface);

                const mouseDir = Physics.screenPosToRay(
                    this.getInput().getMouseScreenPos(),
                    this.getMainCamera()
                );
                const point = Physics.pointOnPlane(
                    mouseDir,
                    this.getGroundPlane()
                );

                worksurface.tags['aux.context.x'] = point.x;
                worksurface.tags['aux.context.y'] = point.z;
                worksurface.tags['aux.context.z'] = point.y;

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

        this.showDialog = false;
        this.contextDialog = '';

        this._time = new Time();
        this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this._subs = [];
        this.simulation3D = new BuilderSimulation3D(
            this,
            appManager.simulationManager.primary
        );
        this._setupScene();
        DebugObjectManager.init(this._time, this._scene);
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
        this._frameUpdate();
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
    }

    private _frameUpdate(xrFrame?: any) {
        DebugObjectManager.update();

        this._input.update();
        this._inputVR.update();
        this._interaction.update();

        this.simulation3D.frameUpdate();

        this._cameraUpdate();
        this._renderUpdate(xrFrame);
        this._time.update();

        // Debug direction light postion with arrow keys + control
        // const speed = 1;
        // const dt = this._time.deltaTime;
        // let dirWorldPos = new Vector3();
        // this._directional.getWorldPosition(dirWorldPos);
        // if (this._input.getKeyHeld('ArrowUp')) {
        //     if (this._input.getKeyHeld('Alt')) {
        //         dirWorldPos.y += speed * dt;
        //     } else {
        //         dirWorldPos.z += speed * dt;
        //     }
        //     console.log('direction world position:', dirWorldPos);
        // }
        // if (this._input.getKeyHeld('ArrowDown')) {
        //     if (this._input.getKeyHeld('Alt')) {
        //         dirWorldPos.y += -speed * dt;
        //     } else {
        //         dirWorldPos.z += -speed * dt;
        //     }
        //     console.log('direction world position:', dirWorldPos);
        // }
        // if (this._input.getKeyHeld('ArrowLeft')) {
        //     dirWorldPos.x += speed * dt;
        //     console.log('direction world position:', dirWorldPos);
        // }
        // if (this._input.getKeyHeld('ArrowRight')) {
        //     dirWorldPos.x += -speed * dt;
        //     console.log('direction world position:', dirWorldPos);
        // }
        // this._directional.position.copy(dirWorldPos);

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
        if (this._uiWorldCamera.zoom !== this._mainCamera.zoom) {
            this._uiWorldCamera.zoom = this._mainCamera.zoom;
            this._uiWorldCamera.updateProjectionMatrix();
        }
    }

    private _renderUpdate(xrFrame?: any) {
        if (this.vrDisplay && this.vrDisplay.isPresenting) {
            this._vrControls.update();
            this._renderCore();
            this._vrEffect.render(this._scene, this._mainCamera);
        } else if (this.xrSession && xrFrame) {
            this._scene.background = null;
            this._renderer.setSize(
                this.xrSession.baseLayer.framebufferWidth,
                this.xrSession.baseLayer.framebufferHeight,
                false
            );
            this._renderer.setClearColor('#000', 0);

            this._mainCamera.matrixAutoUpdate = false;

            for (const view of xrFrame.views) {
                // Each XRView has its own projection matrix, so set the _camera to use that
                let matrix = new Matrix4();
                matrix.fromArray(view.viewMatrix);

                let position = new Vector3();
                position.setFromMatrixPosition(matrix);
                position.multiplyScalar(10);

                // Move the player up about a foot above the world.
                position.add(new Vector3(0, 2, 3));
                this._mainCamera.position.copy(position);

                let rotation = new Quaternion();
                rotation.setFromRotationMatrix(matrix);
                this._mainCamera.setRotationFromQuaternion(rotation);

                this._mainCamera.updateMatrix();
                this._mainCamera.updateMatrixWorld(false);

                this._mainCamera.projectionMatrix.fromArray(
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
            this._mainCamera.matrixAutoUpdate = true;
            this._renderCore();
        }
    }

    private _renderCore(): void {
        this._renderer.clear();
        this._renderer.render(this._scene, this._mainCamera);

        // Set the background color to null when rendering the ui world camera.
        this._scene.background = null;

        this._renderer.clearDepth(); // Clear depth buffer so that ui objects dont
        this._renderer.render(this._scene, this._uiWorldCamera);
        this._sceneBackgroundUpdate();
    }

    private _sceneBackgroundUpdate() {
        if (this._sceneBackground) {
            this._scene.background = this._sceneBackground;
        } else {
            this._scene.background = new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
        }
    }

    private _setupScene() {
        this._scene = new Scene();

        let globalsFile = this.simulation3D.simulation.helper.globalsFile;

        // Scene background color.
        let sceneBackgroundColor = globalsFile.tags['aux.scene.color'];
        this._sceneBackground = hasValue(sceneBackgroundColor)
            ? new Color(sceneBackgroundColor)
            : new Color('#263238');
        this._sceneBackgroundUpdate();

        this.setCameraType('orthographic');
        this._setupRenderer();

        // Ambient light.
        this._ambient = baseAuxAmbientLight();
        this._scene.add(this._ambient);

        // Directional light.
        this._directional = baseAuxDirectionalLight();
        this._scene.add(this._directional);

        // Ground plane.
        this._groundPlane = new Plane(new Vector3(0, 1, 0));

        // Grid plane
        this._gridMesh = new GridHelper(1000, 300, 0xbbbbbb, 0xbbbbbb);
        this._gridMesh.visible = false;
        this._scene.add(this._gridMesh);

        // Simulations
        this._scene.add(this.simulation3D);
    }

    private _setupRenderer() {
        const webGlRenderer = (this._renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;

        this._resizeRenderer();
        this._canvas = this._renderer.domElement;
        this.gameView.appendChild(this._canvas);
    }

    private _setupWebVR() {
        let onBeforeEnter = () => {
            console.log('[GameView] vr on before enter');

            this._renderer.vr.enabled = true;
            this._renderer.shadowMap.enabled = false;

            // VR controls
            this._vrControls = new VRControlsModule(this._mainCamera);
            this._vrControls.standing = true;

            // Create VR Effect rendering in stereoscopic mode
            this._vrEffect = new VREffectModule(this._renderer);
            this._resizeVR();
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
            this._canvas,
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
        this._renderer.shadowMap.enabled = false;

        this._inputVR.disconnectControllers();

        this._vrControls.dispose();
        this._vrControls = null;

        this._vrEffect.dispose();
        this._vrEffect = null;

        // reset camera back to default position.
        this._mainCamera.position.z = 5;
        this._mainCamera.position.y = 3;
        this._mainCamera.rotation.x = ThreeMath.degToRad(-30);
        this._mainCamera.updateMatrixWorld(false);
    }

    private _handleErrorVR(error: any) {
        // console.error('error vr');
        // console.error(error);
    }

    private _handleResize() {
        const { width, height } = this._calculateCameraSize();
        resizeCameraRig(
            {
                mainCamera: this._mainCamera,
                uiWorldCamera: this._uiWorldCamera,
            },
            width,
            height
        );

        this._resizeRenderer();
        this._resizeVR();
    }

    private _resizeRenderer() {
        const { width, height } = this._calculateCameraSize();
        this._renderer.setPixelRatio(window.devicePixelRatio || 1);
        this._renderer.setSize(width, height);
        this._container.style.height = this.gameView.style.height = this._renderer.domElement.style.height;
        this._container.style.width = this.gameView.style.width = this._renderer.domElement.style.width;
    }

    private _resizeVR() {
        if (!this._vrEffect) return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        this._vrEffect.setSize(width, height);
    }

    private _calculateCameraSize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this._container.getBoundingClientRect().top;
        return { width, height };
    }

    private get _container() {
        return <HTMLElement>this.$refs.container;
    }
}
