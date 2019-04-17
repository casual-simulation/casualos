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
    Texture
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';

import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide } from 'vue-property-decorator';
import {
    SubscriptionLike,
} from 'rxjs';
import {
    concatMap, tap,
    flatMap as rxFlatMap
} from 'rxjs/operators';

import {
    File,
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
} from '@casual-simulation/aux-common';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';

import { appManager } from '../../shared/AppManager';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { flatMap, find, findIndex, debounce } from 'lodash';
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
import Home from '../Home/Home';
import { CameraType, resizeCameraRig, createCameraRig } from '../../shared/scene/CameraRigFactory';
import { baseAuxAmbientLight, baseAuxDirectionalLight } from '../../shared/scene/SceneUtils';

@Component({
    components: {
        'mini-file': MiniFile
    }
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

    public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onCameraTypeChanged: ArgEvent<PerspectiveCamera | OrthographicCamera> = new ArgEvent<PerspectiveCamera | OrthographicCamera>();

    private _contexts: BuilderGroup3D[];
    private _subs: SubscriptionLike[];
    private _decoratorFactory: AuxFile3DDecoratorFactory;

    mode: UserMode = DEFAULT_USER_MODE;
    xrCapable: boolean = false;
    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;
    vrDisplay: VRDisplay = null;
    vrCapable: boolean = false;
    selectedRecentFile: Object = null;
    recentFiles: Object[] = [];

    @Inject() addSidebarItem: App['addSidebarItem'];
    @Inject() removeSidebarItem: App['removeSidebarItem'];

    // TODO: Find a better way to refactor this
    @Inject() home: Home;
    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
    get canvas() { return this._canvas; }
    get dev() { return !PRODUCTION; }
    get filesMode() { return this.mode === 'files'; }
    get workspacesMode() { return this.mode === 'worksurfaces'; }
    get fileManager() { return appManager.fileManager; }

    constructor() {
        super();
    }

    public findFilesById(id: string): AuxFile3D[] {
        return flatMap(this._contexts.map(c => c.getFiles().filter(f => f.file.id === id)));
    }

    public getTime() { return this._time; }
    public getInput() { return this._input; }
    public getInputVR() { return this._inputVR; }
    public getScene() { return this._scene; }
    public getRenderer() { return this._renderer; }
    public getGroundPlane() { return this._groundPlane; }
    public getGridChecker() { return this._gridChecker; }
    public getMainCamera(): PerspectiveCamera | OrthographicCamera { return this._mainCamera; }
    public getContexts() {return this._contexts.filter(c => c.contexts.size > 0);}

    public getUIHtmlElements(): HTMLElement[] {
        return [
            ...this.home.getUIHtmlElements(),
            <HTMLElement>this.$refs.fileQueue
        ];
    }

    public setGridsVisible(visible: boolean) {
        this._contexts.forEach(c => {
            if (c.surface) {
                c.surface.gridsVisible = visible;
            }
        });
    }

    public selectRecentFile(file: Object) {
        if (!this.fileManager.recent.selectedRecentFile || this.fileManager.recent.selectedRecentFile.id !== file.id) {
            this.fileManager.recent.selectedRecentFile = file;
            this.fileManager.selection.clearSelection();
        } else {
            this.fileManager.recent.selectedRecentFile = null;
        }
    }

    public clearRecentFiles() {
        this.fileManager.recent.clear();
    }

    public addNewWorkspace(): void {
        // TODO: Make the user have to drag a workspace onto the world
        // instead of just clicking a button and a workspace being placed somewhere.
        this.fileManager.createWorkspace();
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
        const rig = createCameraRig(this._cameraType, this._scene, width, height);

        this._mainCamera = rig.mainCamera;
        this._uiWorldCamera = rig.uiWorldCamera;

        // Update side bar item.
        this.removeSidebarItem('toggle_camera_type');
        if (this._cameraType === 'orthographic') {
            this.addSidebarItem('toggle_camera_type', 'Enable Perspective Camera', () => { this.setCameraType('perspective'); }, 'videocam');
        } else {
            this.addSidebarItem('toggle_camera_type', 'Disable Perspective Camera', () => { this.setCameraType('orthographic'); }, 'videocam_off');
        }

        this.onCameraTypeChanged.invoke(this._mainCamera);
    }


    public async mounted() {
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('vrdisplaypresentchange', this._handleResize);

        this._time = new Time();
        this.recentFiles = this.fileManager.recent.files;
        this._contexts = [];
        this._subs = [];
        this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this._setupScene();
        DebugObjectManager.init(this._time, this._scene);
        this._input = new Input(this);
        this._inputVR = new InputVR(this);
        this._interaction = new BuilderInteractionManager(this);
        this._gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

        // Subscriptions to file events.
        this._subs.push(this.fileManager.filesDiscovered
            .pipe(rxFlatMap(files => files), concatMap(file => this._fileAdded(file)))
            .subscribe());
        this._subs.push(this.fileManager.filesRemoved
            .pipe(rxFlatMap(files => files), tap(file => this._fileRemoved(file)))
            .subscribe());
        this._subs.push(this.fileManager.filesUpdated
            .pipe(rxFlatMap(files => files), concatMap(file => this._fileUpdated(file)))
            .subscribe());

        this._subs.push(this.fileManager.fileChanged(this.fileManager.userFile)
            .pipe(tap(file => {
                this.mode = this._interaction.mode = getUserMode(<Object>file);
                this._gridMesh.visible = this.workspacesMode;
            }))
            .subscribe());

        this._subs.push(this.fileManager.fileChanged(this.fileManager.globalsFile)
            .pipe(tap(file => {

                // Update the scene background color.
                let sceneBackgroundColor = file.tags['aux.scene.color'];
                this._sceneBackground = hasValue(sceneBackgroundColor) ? new Color(sceneBackgroundColor) : new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
                this._scene.background = this._sceneBackground;

            }))
            .subscribe());

        this._subs.push(this.fileManager.recent.onUpdated
            .pipe(tap(_ => {
                this.recentFiles = this.fileManager.recent.files;
                this.selectedRecentFile = this.fileManager.recent.selectedRecentFile;
            }))
            .subscribe());

        this._setupWebVR();
        await this._setupWebXR();
        this._frameUpdate();
    }

    public beforeDestroy() {
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('vrdisplaypresentchange', this._handleResize);
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
        let calc = this.fileManager.createContext();

        this._input.update();
        this._inputVR.update();
        this._interaction.update();

        this._contexts.forEach(context => {
            context.frameUpdate(calc);
        });

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

            this.xrSession.requestFrame((nextXRFrame: any) => this._frameUpdate(nextXRFrame));

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
            this._renderer.setSize(this.xrSession.baseLayer.framebufferWidth, this.xrSession.baseLayer.framebufferHeight, false)
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

                this._mainCamera.projectionMatrix.fromArray(view.projectionMatrix);

                // Set up the _renderer to the XRView's viewport and then render
                const viewport = view.getViewport(this.xrSession.baseLayer);
                this._renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);

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
        this._scene.background = this._sceneBackground;
    }

    private async _fileUpdated(file: AuxFile, initialUpdate = false) {
        let shouldRemove = false;
        const calc = this.fileManager.createContext();
        // TODO: Work with all domains
        let configTags = getFileConfigContexts(calc, file);
        if (configTags.length === 0) {
            if (!initialUpdate) {
                if (!file.tags._user && file.tags._lastEditedBy === this.fileManager.userFile.id) {
                    if (this.fileManager.recent.selectedRecentFile && file.id === this.fileManager.recent.selectedRecentFile.id) {
                        this.fileManager.recent.selectedRecentFile = file;
                    } else {
                        this.fileManager.recent.selectedRecentFile = null;
                    }
                    // this.addToRecentFilesList(file);
                }
            }

            if (file.tags._destroyed) {
                shouldRemove = true;
            }
        } else {
            if (file.tags.size <= 0) {
                shouldRemove = true;
            }
        }

        await Promise.all([...this._contexts.values()].map(c => c.fileUpdated(file, [], calc)));
        // await obj.updateFile(file);
        this.onFileUpdated.invoke(file);

        if (shouldRemove) {
            this._fileRemoved(file.id);
        }
    }

    private async _fileAdded(file: AuxFile) {
        if (file.tags._destroyed) {
            return;
        }
        // console.log(`[GameView] File Added`, file.id);

        let context = new BuilderGroup3D(file, this._decoratorFactory);
        context.setGridChecker(this._gridChecker);
        this._contexts.push(context);
        this._scene.add(context);

        let calc = this.fileManager.createContext();
        await Promise.all([...this._contexts.values()].map(c => c.fileAdded(file, calc)));

        // if (!this._shouldDisplayFile(file)) {
        //     return;
        // }

        // var obj = new File3D(this, file);

        // this._files[file.id] = obj;
        // this._fileIds[obj.mesh.id] = obj.file.id;

        await this._fileUpdated(file, true);
        this.onFileAdded.invoke(file);
    }

    private _fileRemoved(id: string) {
        const calc = this.fileManager.createContext();
        let removedIndex: number = -1;
        this._contexts.forEach((context, index) => {
            context.fileRemoved(id, calc);

            if (context.file.id === id) {
                removedIndex = index;
            }
        });

        if (removedIndex >= 0) {
            const context = this._contexts[removedIndex];
            this._scene.remove(context);
            this._contexts.splice(removedIndex, 1);
        }

        this.onFileRemoved.invoke(null);

        // const obj = this._files[id];
        // if (obj) {
        //   delete this._fileIds[obj.mesh.id];
        //   delete this._files[id];
        //   obj.dispose();

        // }
    }

    private _setupScene() {

        this._scene = new Scene();

        let globalsFile = this.fileManager.globalsFile;

        // Scene background color.
        let sceneBackgroundColor = globalsFile.tags['aux.scene.color'];
        this._scene.background = hasValue(sceneBackgroundColor) ? new Color(sceneBackgroundColor) : new Color(DEFAULT_SCENE_BACKGROUND_COLOR);

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
        this._gridMesh = new GridHelper(1000, 300, 0xBBBBBB, 0xBBBBBB);
        this._gridMesh.visible = false;
        this._scene.add(this._gridMesh);
    }

    private _setupRenderer() {

        const webGlRenderer = this._renderer = new WebGLRenderer({
            antialias: true,
            alpha: true
        });
        webGlRenderer.autoClear = false;

        this._resizeRenderer();
        this._canvas = this._renderer.domElement;
        this.gameView.appendChild(this._canvas);
    }

    private _setupWebVR() {

        let onBeforeEnter = () => {
            console.log("[GameView] vr on before enter");

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
            beforeEnter: onBeforeEnter
        };

        this._enterVr = new webvrui.EnterVRButton(this._canvas, vrButtonOptions);

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
            videoFrames: false,    //computer_vision_data
            alignEUS: true,
            worldSensing: false
        };
        const matchingDisplay = find(displays, d => d.supportsSession(this.xrSessionInitParameters));
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
                this.xrSession = await this.xrDisplay.requestSession(this.xrSessionInitParameters);
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) => this._handleXRSessionFocus(ev));
                this.xrSession.addEventListener('blur', (ev: any) => this._handleXRSessionBlur(ev));
                this.xrSession.addEventListener('end', (ev: any) => this._handleXRSessionEnded(ev));

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
        this.xrSession.baseLayer = new win.XRWebGLLayer(this.xrSession, this._renderer.context);

        // Handle layer focus events
        this.xrSession.baseLayer.addEventListener('focus', (ev: any) => { this._handleXRLayerFocus(ev) })
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => { this._handleXRLayerBlur(ev) })

        // this.xrSession.requestFrame(this._boundHandleFrame)
    }

    private _handleXRSessionFocus(event: any) {
    }

    private _handleXRSessionBlur(event: any) {
    }

    private _handleXRSessionEnded(event: any) {
    }

    private _handleXRLayerFocus(event: any) {
    }

    private _handleXRLayerBlur(event: any) {
    }

    private _isRealAR(xrDisplay: any): boolean {
        // The worst hack of all time.
        // Basically does the check that the webxr polyfill does
        // to see it the device really supports Web XR.
        return typeof (<any>window).webkit !== 'undefined' ||
            xrDisplay._reality._vrDisplay;
    }

    private _handleReadyVR(display: VRDisplay) {

        console.log("[GameView] vr display is ready.");
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
        resizeCameraRig({ mainCamera: this._mainCamera, uiWorldCamera: this._uiWorldCamera }, width, height);

        this._resizeRenderer();
        this._resizeVR();
    }

    private _resizeRenderer() {
        // TODO: Call each time the screen size changes
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
        const height = window.innerHeight - this._container.getBoundingClientRect().top;
        return { width, height };
    }

    private get _container() {
        return <HTMLElement>this.$refs.container;
    }
};
