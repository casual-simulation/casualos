import {
  Scene,
  Renderer,
  Mesh,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Math as ThreeMath,
  Group,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  BackSide,
  TextureLoader,
  SphereBufferGeometry,
  GLTFLoader,
  HemisphereLight,
  Vector2,
  CylinderGeometry,
  BoxGeometry,
  Fog,
  FogExp2,
  PCFShadowMap,
  BasicShadowMap,
  Plane,
  Vector3,
  GridHelper,
  Quaternion,
  Matrix4,
  Layers,
  Texture
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import * as webvrui from 'webvr-ui';

import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch, Provide } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';
import {
  concatMap, tap,
} from 'rxjs/operators';

import { 
  File,
  Object,
  Workspace,
  DEFAULT_WORKSPACE_HEIGHT_INCREMENT,
  DEFAULT_USER_MODE,
  UserMode,
  DEFAULT_SCENE_BACKGROUND_COLOR,
  getUserMode,
  createFile,
  doFilesAppearEqual,
  AuxFile,
  createCalculationContext
} from '@yeti-cgi/aux-common';
import { ArgEvent } from '@yeti-cgi/aux-common/Events';
import { Time } from '../../shared/scene/Time';
import { Input, InputType } from '../../shared/scene/Input';
import { InputVR } from '../../shared/scene/InputVR';

// import skyTexturePath from '../public/images/CGSkies_0132_free.jpg';
// import groundModelPath from '../public/models/ground.gltf';
import { appManager } from '../../shared/AppManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { values, flatMap, find, findIndex, debounce } from 'lodash';
import App from '../App/App';
import MiniFile from '../MiniFile/MiniFile';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { IGameView } from '../../shared/IGameView';
import { LayersHelper } from '../../shared/scene/LayersHelper';
import { AuxFile3DDecoratorFactory } from '../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { DebugObjectManager } from '../../shared/scene/DebugObjectManager';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';

@Component({
  components: {
    'mini-file': MiniFile
  }
})
export default class GameView extends Vue implements IGameView {
  private _scene: Scene;
  private _mainCamera: PerspectiveCamera;
  private _uiWorldCamera: PerspectiveCamera;
  private _renderer: WebGLRenderer;

  private _enterVr: any;
  private _vrControls: any;
  private _vrEffect: any;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _groundPlane: Plane;
  private _gridMesh: GridHelper;
  private _canvas: HTMLCanvasElement;
  private _time: Time;
  private _input: Input;
  private _inputVR: InputVR;
  private _interaction: InteractionManager;
  private _gridChecker: GridChecker;
  private _originalBackground: Color | Texture;

  public onFileAdded: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
  public onFileUpdated: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();
  public onFileRemoved: ArgEvent<AuxFile> = new ArgEvent<AuxFile>();

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
  @Provide() fileRenderer: FileRenderer = new FileRenderer();

  get fileQueue(): HTMLElement { return <HTMLElement>this.$refs.fileQueue; }
  get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
  get canvas() { return this._canvas; }
  get time(): Time { return this._time; }
  get input(): Input { return this._input; }
  get inputVR(): InputVR { return this._inputVR; }
  get mainCamera(): PerspectiveCamera { return this._mainCamera; }
  get scene(): Scene { return this._scene; }
  get renderer() { return this._renderer; } 
  get dev() { return !PRODUCTION; }
  get filesMode() { return this.mode === 'files'; }
  get workspacesMode() { return this.mode === 'worksurfaces'; }
  get groundPlane() { return this._groundPlane; }
  get gridChecker() { return this._gridChecker; }
  get fileManager() { return appManager.fileManager; }

  constructor() {
    super();
    this.addToRecentFilesList = debounce(this.addToRecentFilesList.bind(this), 100);
    this.onFileAdded = new ArgEvent<AuxFile>();
    this.onFileUpdated = new ArgEvent<AuxFile>();
    this.onFileRemoved = new ArgEvent<AuxFile>();
  }

  public setGridsVisible(visible: boolean) {
      this._contexts.forEach(c => {
        if(c.surface) {
            c.surface.gridsVisible = visible;
        }
      });
  }

  public findFilesById(id: string): AuxFile3D[] {
      return flatMap(this._contexts.map(c => c.getFiles().filter(f => f.file.id === id)));
  }

  public async mounted() {
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    window.addEventListener('vrdisplaypresentchange', this._handleResize);
    
    this._time = new Time();
    this.recentFiles = [
      createFile()
    ];
    this._contexts = [];
    this._subs = [];
    this._decoratorFactory = new AuxFile3DDecoratorFactory(this);
    this._setupScene();
    DebugObjectManager.init(this._scene);
    this._input = new Input(this);
    this._inputVR = new InputVR(this);
    this._interaction = new InteractionManager(this);
    this._gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);
    // this.fileRenderer = new FileRenderer();

    // Subscriptions to file events.
    this._subs.push(this.fileManager.fileDiscovered
      .pipe(concatMap(file => this._fileAdded(file)))
      .subscribe());
    this._subs.push(this.fileManager.fileRemoved
      .pipe(tap(file => this._fileRemoved(file)))
      .subscribe());
    this._subs.push(this.fileManager.fileUpdated
      .pipe(concatMap(file => this._fileUpdated(file)))
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
        let sceneBackgroundColor = (<Object>file).tags._sceneBackgroundColor;
        if (sceneBackgroundColor) {
          this._scene.background = new Color(sceneBackgroundColor);;
        }

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

    let calc = this.fileManager.createContext();

    this._input.update();
    this._inputVR.update();
    this._interaction.update();

    this._contexts.forEach(context => {
        context.frameUpdate(calc);
    });

    DebugObjectManager.frameUpdate();

    this._renderUpdate(xrFrame);
    this._time.update();

    if (this.vrDisplay && this.vrDisplay.isPresenting) {

      this.vrDisplay.requestAnimationFrame(() => this._frameUpdate());

    } else if(this.xrSession) {

      this.xrSession.requestFrame((nextXRFrame: any) => this._frameUpdate(nextXRFrame));

    } else {

      requestAnimationFrame(() => this._frameUpdate());

    }
  }

  private _renderUpdate(xrFrame?: any) {

    if (this.vrDisplay && this.vrDisplay.isPresenting) {

      this._vrControls.update();
      this._renderCore();
      this._vrEffect.render(this._scene, this._mainCamera);

    } else if(this.xrSession && xrFrame) {

      // Update XR stuff
      if (this._scene.background !== null){ 
          this._originalBackground = this._scene.background.clone();
      }
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
    if (this._scene.background !== null) {
        this._originalBackground = this._scene.background.clone();
    }

    this._scene.background = null;
    this._renderer.clearDepth(); // Clear depth buffer so that ui objects dont 
    this._renderer.render(this._scene, this._uiWorldCamera);
    this._scene.background = this._originalBackground;
  }

  public selectRecentFile(file: Object) {
    if(!this.selectedRecentFile || this.selectedRecentFile.id !== file.id) {
      this.selectedRecentFile = file;
      this.addToRecentFilesList(file, true);
    } else {
      this.selectedRecentFile = null;
    }
  }

  /**
   * Returns the file id that is represented by the specified mesh id.
   * @param meshId The id of the mesh.
   */
//   public getFileId(meshId: number): string {
//     return this._fileIds[meshId];
//   }

  /**
   * Returns the file that matches the specified file id.
   * @param fileId The id of the file.
   */
//   public getFile(fileId: string): File3D {
//     return this._files[fileId];
//   }

  /**
   * Gets all of the files.
   */
//   public getFiles() {
//     return values(this._files);
//   }

  /**
   * Gets all of the objects.
   */
//   public getObjects() {
//     return this.getFiles().filter(file => !file.file.tags._isWorkspace);
//   }

  /**
   * Gets all of the workspaces.
   */
//   public getWorkspaces() {
//     return this.getFiles().filter(file => file.file.tags._isWorkspace);
//   }

  /**
   * Gets the list of contexts that this game view contains.
   */
  public getContexts() {
      return this._contexts.filter(c => c.contexts.size > 0);
  }

  /**
   * Adds the given file to the recent files list.
   * If it already exists in the list then it will be moved to the front.
   * @param file The file to add to the list.
   * @param updateList Whether the list should be reordered.
   */
  public addToRecentFilesList(file: Object, reorderList: boolean = false) {
    const index = findIndex(this.recentFiles, f => doFilesAppearEqual(file, f));
    // if file is already in the list
    if (index >= 0) {

      // If we shouldn't reorder the list
      if (!reorderList) {
        const existing = this.recentFiles[index];
        
        // If the file is in the list and the selection hasn't changed
        if (doFilesAppearEqual(existing, file, { ignoreSelectionTags: false, ignoreId: true })) {
          // Then just update the current entry with the updated values
          this.recentFiles.splice(index, 1, file);
          return;
        }
        // Otherwise move the file to the beginning of the list.
      }
      this.recentFiles.splice(index, 1);
    }
    this.recentFiles.unshift(file);
    if (this.recentFiles.length > 3) {
      this.recentFiles.splice(3, this.recentFiles.length - 2);
      // this.recentFiles.length = 3;
    }
  }

  public addNewWorkspace(): void {
    // TODO: Make the user have to drag a workspace onto the world
    // instead of just clicking a button and a workspace being placed somewhere.
    this.fileManager.createWorkspace();
  }

  private async _fileUpdated(file: AuxFile, initialUpdate = false) {
    let shouldRemove = false;
    // TODO: Work with all domains
    if (!file.tags['builder.context']) {
        if (!initialUpdate) { 
            if (!file.tags._user && file.tags._lastEditedBy === this.fileManager.userFile.id) {
                if (this.selectedRecentFile  && file.id === this.selectedRecentFile.id) {
                    this.selectedRecentFile = file;
                } else {
                    this.selectedRecentFile = null;
                }
                this.addToRecentFilesList(file);
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

    const calc = this.fileManager.createContext();
    await Promise.all([...this._contexts.values()].map(c => c.fileUpdated(file, [], calc)));
    // await obj.updateFile(file);
    this.onFileUpdated.invoke(file);

    if (shouldRemove) {
        this._fileRemoved(file.id);
    }
  }

  private async _fileAdded(file: AuxFile) {
    let context = new BuilderGroup3D(file, this._decoratorFactory);
    context.setGridChecker(this._gridChecker);
    this._contexts.push(context);
    this.scene.add(context);

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
        this.scene.remove(context);
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

  /**
   * Returns wether or not the given file should be displayed in 3d.
   * @param file The file
   */
  private _shouldDisplayFile(file: File): boolean {
    // Don't display files without a defined type.
    // if (!file.type) {
    //     return false;
    // }

    if (!file.tags._user) {
        // Dont display normal files that are hidden or destroyed.
        if (file.tags._destroyed) {
            return false;
        }
    }

    return true;
  }

  private _setupScene() {

    this._scene = new Scene();

    let globalsFile = this.fileManager.globalsFile;
    
    if (globalsFile && globalsFile.tags._sceneBackgroundColor) {
      this.scene.background = new Color(globalsFile.tags._sceneBackgroundColor);
    } else {
      this.scene.background = new Color(DEFAULT_SCENE_BACKGROUND_COLOR);
    }
    
    // Main camera
    this._mainCamera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
    this._mainCamera.position.z = 5;
    this._mainCamera.position.y = 3;
    this._mainCamera.rotation.x = ThreeMath.degToRad(-30);
    this._mainCamera.layers.enable(LayersHelper.Layer_Default);

    // UI World camera.
    // This camera is parented to the main camera.
    this._uiWorldCamera = new PerspectiveCamera(this._mainCamera.fov, this._mainCamera.aspect, this._mainCamera.near, this._mainCamera.far);
    this._mainCamera.add(this._uiWorldCamera);
    this._uiWorldCamera.position.set(0,0,0);
    this._uiWorldCamera.rotation.set(0,0,0);

    // Ui World camera only draws objects on the 'UI World Layer'.
    this._uiWorldCamera.layers.set(LayersHelper.Layer_UIWorld);

    this._mainCamera.updateMatrixWorld(true);
    
    this._resizeCamera();
    this._setupRenderer();

    // Ambient light.
    this._ambient = new AmbientLight(0xffffff, 0.7);
    this._scene.add(this._ambient);

    // Sky light.
    this._skylight = new HemisphereLight(0xc1e0fd, 0xffffff, .6);
    this._scene.add(this._skylight);

    // Sun light.
    this._sun = new DirectionalLight(0xffffff, .6);
    this._sun.position.set(5, 5, 5);
    this._sun.position.multiplyScalar(50);
    this._sun.name = "sun";
    this._sun.castShadow = true;
    this._sun.shadowMapWidth = this._sun.shadowMapHeight = 1024 * 2;

    var d = 30;
    this._sun.shadow.camera.left = -d;
    this._sun.shadow.camera.right = d;
    this._sun.shadow.camera.top = d;
    this._sun.shadow.camera.bottom = -d;
    this._sun.shadow.camera.far = 3500;

    this._scene.add(this._sun);

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
    webGlRenderer.shadowMap.enabled = false;
    webGlRenderer.shadowMap.type = PCFSoftShadowMap;

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

      if(this.xrSession) {
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
    if (this.xrSession === null){
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
    this.input.currentInputType = InputType.Touch;
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
    this._resizeCamera();
    this._resizeRenderer();
    this._resizeVR();
  }

  private _resizeRenderer() {
    // TODO: Call each time the screen size changes
    const { width, height } = this._calculateSize();
    this._renderer.setPixelRatio(window.devicePixelRatio || 1);
    this._renderer.setSize(width, height);
    this._container.style.height = this.gameView.style.height = this._renderer.domElement.style.height;
    this._container.style.width = this.gameView.style.width = this._renderer.domElement.style.width;
  }

  private _resizeCamera() {
    const { width, height } = this._calculateSize();
    this._mainCamera.aspect = width / height;
    this._mainCamera.updateProjectionMatrix();

    this._uiWorldCamera.aspect = this._mainCamera.aspect;
    this._uiWorldCamera.updateProjectionMatrix();
  }

  private _resizeVR() {
    if (!this._vrEffect) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    this._vrEffect.setSize(width, height);
  }

  private _calculateSize() {
    const width = window.innerWidth;
    const height = window.innerHeight - this._container.getBoundingClientRect().top;
    return { width, height };
  }

  private get _container() {
    return <HTMLElement>this.$refs.container;
  }
};
