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
} from '@casual-simulation/aux-common';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';
import { appManager } from '../../shared/AppManager';
import { find, flatMap, uniqBy } from 'lodash';
import App from '../App/App';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { PlayerInteractionManager } from '../interaction/PlayerInteractionManager';
import InventoryFile from '../InventoryFile/InventoryFile';
import MenuFile from '../MenuFile/MenuFile';
import { InventoryContext, InventoryItem } from '../InventoryContext';
import { doesFileDefinePlayerContext } from '../PlayerUtils';
import {
    CameraType,
    resizeCameraRig,
    createCameraRig,
} from '../../shared/scene/CameraRigFactory';
import {
    baseAuxAmbientLight,
    baseAuxDirectionalLight,
} from '../../shared/scene/SceneUtils';
import { TweenCameraToOperation } from '../../shared/interaction/TweenCameraToOperation';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { PlayerSimulation3D } from '../scene/PlayerSimulation3D';
import { Simulation } from '../../shared/Simulation';
import { MenuItem } from '../MenuContext';
import { SimulationItem } from '../SimulationContext';

@Component({
    components: {
        'inventory-file': InventoryFile,
        'menu-file': MenuFile,
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
    private _canvas: HTMLCanvasElement;
    private _time: Time;
    private _input: Input;
    private _inputVR: InputVR;
    private _interaction: PlayerInteractionManager;
    private _sceneBackground: Color | Texture;
    private _contextBackground: Color | Texture;
    private _cameraType: CameraType;

    public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
    public onCameraTypeChanged: ArgEvent<
        PerspectiveCamera | OrthographicCamera
    > = new ArgEvent<PerspectiveCamera | OrthographicCamera>();

    private simulations: PlayerSimulation3D[] = [];

    private _fileSubs: SubscriptionLike[];
    private _decoratorFactory: AuxFile3DDecoratorFactory;

    xrCapable: boolean = false;
    xrDisplay: any = null;
    xrSession: any = null;
    xrSessionInitParameters: any = null;
    vrDisplay: VRDisplay = null;
    vrCapable: boolean = false;

    menuExpanded: boolean = true;

    @Inject() addSidebarItem: App['addSidebarItem'];
    @Inject() removeSidebarItem: App['removeSidebarItem'];
    @Inject() removeSidebarGroup: App['removeSidebarGroup'];
    @Prop() context: string;

    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }
    get canvas() {
        return this._canvas;
    }
    get dev(): boolean {
        return !PRODUCTION;
    }
    get filesMode(): boolean {
        console.error('AUX Player does not implement filesMode.');
        return false;
    }
    get workspacesMode(): boolean {
        console.error('AUX Player does not implement workspacesMode.');
        return false;
    }

    get inventory() {
        let items: InventoryItem[] = [];

        this.simulations.forEach(sim => {
            if (sim.inventoryContext) {
                for (let i = 0; i < sim.inventoryContext.slots.length; i++) {
                    items[i] = sim.inventoryContext.slots[i];
                }
            }
        });

        return items;
    }

    get menu() {
        let items: MenuItem[] = [];
        this.simulations.forEach(sim => {
            if (sim.menuContext) {
                for (let i = 0; i < sim.menuContext.items.length; i++) {
                    items[i] = sim.menuContext.items[i];
                }
            }
        });
        return items;
    }

    get sims() {
        let items: SimulationItem[] = [];
        this.simulations.forEach(sim => {
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

        return items;
    }

    @Watch('sims')
    onSimsUpdated() {
        this.removeSidebarGroup('simulations');
        this.sims.forEach(s => {
            this.addSidebarItem(
                s.simulationToLoad,
                s.simulationToLoad,
                () => {},
                undefined,
                'simulations'
            );
        });
    }

    // get fileManager() {
    //     return appManager.simulationManager.primary;
    // }

    constructor() {
        super();
        this.simulations = [];
    }

    public findFilesById(id: string): AuxFile3D[] {
        return flatMap(flatMap(this.simulations, s => s.contexts), c =>
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
    public getMainCamera(): PerspectiveCamera | OrthographicCamera {
        return this._mainCamera;
    }
    // public getContexts(): ContextGroup3D[] {
    //     return [this._contextGroup];
    // }
    public getUIHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.inventory];
    }
    public getDecoratorFactory(): AuxFile3DDecoratorFactory {
        return this._decoratorFactory;
    }
    public getGridChecker(): GridChecker {
        return null;
    }
    public getSimulations(): Simulation3D[] {
        return this.simulations;
    }
    public getContexts(): ContextGroup3D[] {
        return flatMap(this.simulations, s => s.contexts);
    }

    public setGridsVisible(visible: boolean) {
        // This currently does nothing for AUX Player, we dont really show any grids right now.
    }

    public setWorldGridVisible(visible: boolean) {}

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

    public async mounted() {
        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('vrdisplaypresentchange', this._handleResize);

        this._time = new Time();
        this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
        this._fileSubs = [];
        this.simulations = [];
        this._setupScene();
        DebugObjectManager.init(this._time, this._scene);
        this._input = new Input(this);
        this._inputVR = new InputVR(this);
        this._interaction = new PlayerInteractionManager(this);

        this._setupWebVR();
        await this._setupWebXR();
        this._triggerFilesRefresh();
        this._frameUpdate();

        this._fileSubs.push(
            appManager.simulationManager.simulationAdded
                .pipe(
                    tap(sim => {
                        this._simulationAdded(sim);
                    })
                )
                .subscribe()
        );

        this._fileSubs.push(
            appManager.simulationManager.simulationRemoved
                .pipe(
                    tap(sim => {
                        this._simulationRemoved(sim);
                    })
                )
                .subscribe()
        );

        this.addSidebarItem('add_simulation', 'Add Simulation', async () => {
            console.log('[GameView] Add simulation!');
            const primarySim = appManager.simulationManager.primary;
            await primarySim.helper.createFile(undefined, {
                [primarySim.helper.userFile.tags[
                    'aux._userSimulationsContext'
                ]]: true,
                ['aux.simulation']: 'test',
            });
        });
    }

    private _simulationAdded(sim: Simulation) {
        const sim3D = new PlayerSimulation3D(this.context, this, sim);
        sim3D.init();
        this.simulations.push(sim3D);
        this._scene.add(sim3D);
    }

    private _simulationRemoved(sim: Simulation) {
        const index = this.simulations.findIndex(
            s => s.simulation.id === sim.id
        );
        if (index >= 0) {
            const removed = this.simulations.splice(index, 1);
            removed.forEach(s => {
                s.unsubscribe();
                this._scene.remove(s);
            });
        }
    }

    public beforeDestroy() {
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener(
            'vrdisplaypresentchange',
            this._handleResize
        );
        this.removeSidebarItem('enable_xr');
        this.removeSidebarItem('disable_xr');
        this.removeSidebarItem('debug_mode');
        this.removeSidebarItem('add_simulation');
        this.removeSidebarGroup('simulations');
        this._input.dispose();

        if (this._fileSubs) {
            this._fileSubs.forEach(sub => {
                sub.unsubscribe();
            });
            this._fileSubs = [];
        }
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

    private _frameUpdate(xrFrame?: any) {
        DebugObjectManager.update();

        // let calc = this.fileManager.helper.createContext();

        this._input.update();
        this._inputVR.update();
        this._interaction.update();

        this.simulations.forEach(s => {
            s.frameUpdate();
        });
        // if (this._contextGroup) {
        //     this._contextGroup.frameUpdate(calc);
        // }

        // TODO: Fix
        // if (this.inventoryContext) {
        //     this.inventoryContext.frameUpdate(calc);
        // }

        // if (this.menuContext) {
        //     this.menuContext.frameUpdate(calc);
        // }

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

    /**
     * Trigger a refresh of the GameView's file representations.
     * This will effectively clear all current file representations and create new ones for the current context.
     */
    private _triggerFilesRefresh(): void {
        // Unsubscribe from current file events.
        if (this._fileSubs) {
            this._fileSubs.forEach(sub => {
                sub.unsubscribe();
            });
            this._fileSubs = [];
        }

        // Clear our file buffer.
        // this._fileBackBuffer = new Map<string, AuxObject>();

        // Dispose of the current context group.
        // TODO: Fix
        // if (this._contextGroup) {
        //     this._contextGroup.dispose();
        //     this._scene.remove(this._contextGroup);
        //     this._contextGroup = null;
        // }

        // Dispose of the current inventory context.
        // if (this.inventoryContext) {
        //     this.inventoryContext.dispose();
        //     this.inventoryContext = null;
        // }

        // // Dispose of the current inventory context.
        // if (this.menuContext) {
        //     this.menuContext.dispose();
        //     this.menuContext = null;
        // }

        // Subscribe to file events.

        // TODO: Fix
        // this._fileSubs.push(
        //     this.fileManager.watcher
        //         .fileChanged(this.fileManager.helper.globalsFile)
        //         .pipe(
        //             tap(file => {
        //                 // Update the scene background color.
        //                 let sceneBackgroundColor = file.tags['aux.scene.color'];
        //                 this._sceneBackground = hasValue(sceneBackgroundColor)
        //                     ? new Color(sceneBackgroundColor)
        //                     : new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
        //                 this._sceneBackgroundUpdate();
        //             })
        //         )
        //         .subscribe()
        // );
    }

    // private _fileRemoved(id: string) {
    //     const calc = this.fileManager.helper.createContext();
    //     if (this._contextGroup) {
    //         this._contextGroup.fileRemoved(id, calc);

    //         if (this._contextGroup.file.id === id) {
    //             // File that defined player context has been removed.
    //             // Dispose of the context group.
    //             this._contextGroup.dispose();
    //             this._scene.remove(this._contextGroup);
    //             this._contextGroup = null;
    //         }
    //     }

    //     if (this.inventoryContext) {
    //         this.inventoryContext.fileRemoved(id, calc);
    //     }

    //     if (this.menuContext) {
    //         this.menuContext.fileRemoved(id, calc);
    //     }

    //     this.onFileRemoved.invoke(null);
    // }

    private _sceneBackgroundUpdate() {
        if (this._contextBackground) {
            this._scene.background = this._contextBackground;
        } else if (this._sceneBackground) {
            this._scene.background = this._sceneBackground;
        } else {
            this._scene.background = new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
        }
    }

    private _setupScene() {
        this._scene = new Scene();

        // TODO: Fix
        // let globalsFile = this.fileManager.helper.globalsFile;

        // // Scene background color.
        // let sceneBackgroundColor = globalsFile.tags['aux.scene.color'];
        // this._sceneBackground = hasValue(sceneBackgroundColor)
        //     ? new Color(sceneBackgroundColor)
        //     : new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
        // this._sceneBackgroundUpdate();

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
    }

    private _setupRenderer() {
        const webGlRenderer = (this._renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
        }));
        webGlRenderer.autoClear = false;
        webGlRenderer.shadowMap.enabled = false;
        webGlRenderer.shadowMap.type = PCFSoftShadowMap;

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

            return new Promise(resolve => {
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
                this._toggleXR();
            });
            console.log('[GameView] WebXR Supported!');
        }
    }

    private async _toggleXR() {
        console.log('toggle XR');
        if (this.xrDisplay) {
            if (this.xrSession) {
                this.removeSidebarItem('disable_xr');
                this.addSidebarItem('enable_xr', 'Enable AR', () => {
                    this._toggleXR();
                });

                await this.xrSession.end();
                this.xrSession = null;
                document.documentElement.classList.remove('ar-app');
            } else {
                this.removeSidebarItem('enable_xr');
                this.addSidebarItem('disable_xr', 'Disable AR', () => {
                    this._toggleXR();
                });

                document.documentElement.classList.add('ar-app');
                this.xrSession = await this.xrDisplay.requestSession(
                    this.xrSessionInitParameters
                );
                this.xrSession.near = 0.1;
                this.xrSession.far = 1000;

                this.xrSession.addEventListener('focus', (ev: any) =>
                    this._handleXRSessionFocus()
                );
                this.xrSession.addEventListener('blur', (ev: any) =>
                    this._handleXRSessionBlur()
                );
                this.xrSession.addEventListener('end', (ev: any) =>
                    this._handleXRSessionEnded()
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
            this._handleXRLayerFocus();
        });
        this.xrSession.baseLayer.addEventListener('blur', (ev: any) => {
            this._handleXRLayerBlur();
        });

        // this.xrSession.requestFrame(this._boundHandleFrame)
    }

    private _handleXRSessionFocus() {}

    private _handleXRSessionBlur() {}

    private _handleXRSessionEnded() {}

    private _handleXRLayerFocus() {}

    private _handleXRLayerBlur() {}

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

    private _handleErrorVR() {
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
        const height =
            window.innerHeight - this._container.getBoundingClientRect().top;
        return { width, height };
    }

    private get _container() {
        return <HTMLElement>this.$refs.container;
    }
}
