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
  doFilesAppearEqual
} from '@yeti-cgi/aux-common';
import { ArgEvent } from '@yeti-cgi/aux-common/Events';
import { Time } from '../../aux-scene/Time';
import { Input, InputType } from '../../aux-scene/Input';
import { InputVR } from '../../aux-scene/InputVR';
import { File3D } from '../../aux-scene/File3D';

// import skyTexturePath from '../public/images/CGSkies_0132_free.jpg';
// import groundModelPath from '../public/models/ground.gltf';
import { appManager } from '../AppManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { WorkspaceMesh, WorkspaceMeshDebugInfo } from '../../aux-scene/WorkspaceMesh';
import { GridChecker } from '../../aux-scene/grid/GridChecker';
import { values, flatMap, find, findIndex, debounce } from 'lodash';
import App from '../App/App';
import MiniFile from '../MiniFile/MiniFile';
import { FileRenderer } from '../../aux-scene/FileRenderer';

@Component({
  components: {
    'mini-file': MiniFile
  }
})
export default class GameView extends Vue {
  private _debug: boolean;
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
  private _groundPlaneMesh: Mesh;
  private _skydomeMesh: Mesh;
  private _gridMesh: GridHelper;
  private _canvas: HTMLCanvasElement;
  private _time: Time;
  private _input: Input;
  private _inputVR: InputVR;
  private _interaction: InteractionManager;
  private _gridChecker: GridChecker;
  private _originalBackground: Color | Texture;

  public onFileAdded: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileUpdated: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileRemoved: ArgEvent<File3D> = new ArgEvent<File3D>();

  public static readonly Layer_Default: number = 0;
  public static readonly Layer_UIWorld: number = 1;

  /**
   * A map of file IDs to files and meshes.
   */
  private _files: {
    [id: string]: File3D
  } = {};

  /**
   * A map of mesh IDs to file IDs.
   */
  private _fileIds: {
    [mesh: number]: string
  } = {};

  private _subs: SubscriptionLike[];

  debug: boolean = false;
  debugInfo: GameViewDebugInfo = null;
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

  @Watch('debug')
  debugChanged(val: boolean, previous: boolean) {
    this.showDebugInfo(val);
    this.updateDebugInfo();
  }

  updateDebugInfo() {
    this.getFiles().forEach(f => f.mesh.update());
    this.debugInfo = {
      workspaces: this.getWorkspaces().map(w => (<WorkspaceMesh>w.mesh).getDebugInfo()),
    };
  }

  selectRecentFile(file: Object) {
    if(!this.selectedRecentFile || this.selectedRecentFile.id !== file.id) {
      this.selectedRecentFile = file;
      this.addToRecentFilesList(file, true);
    } else {
      this.selectedRecentFile = null;
    }
  }

  get fileQueue(): HTMLElement { return <HTMLElement>this.$refs.fileQueue; }
  get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
  get canvas() { return this._canvas; }
  get time(): Time { return this._time; }
  get input(): Input { return this._input; }
  get inputVR(): InputVR { return this._inputVR; }
  get interactionManager(): InteractionManager { return this._interaction; }
  get mainCamera(): PerspectiveCamera { return this._mainCamera; }
  get scene(): Scene { return this._scene; }
  get renderer() { return this._renderer; } 
  get dev() { return !PRODUCTION; }
  get filesMode() { return this.mode === 'files'; }
  get workspacesMode() { return this.mode === 'worksurfaces'; }
  get groundPlane() { return this._groundPlane; }

  get gridChecker() { return this._gridChecker; }

  get fileManager() {
    return appManager.fileManager;
  }

  constructor() {
    super();
    this.addToRecentFilesList = debounce(this.addToRecentFilesList.bind(this), 100);
  }

  addNewFile() {
    const workspace = this.getWorkspaces()[0];
    let tags: Object['tags'] = undefined;
    if(workspace) {
      // Find a valid point to place a cube on.
      const mesh =<WorkspaceMesh>workspace.mesh;
      const validPoints = flatMap(mesh.squareGrids, g => ({ tiles: g.level.tiles.filter(t => t.valid), level: g.level }))
        .filter(g => g.tiles.length > 0)
        .map(g => ({
          pos: g.tiles[0].gridPosition,
          height: g.level.tileHeight
        }));
      const firstValidPoint = validPoints[0];
      if (firstValidPoint) {
        tags = {
          _position: { x: firstValidPoint.pos.x, y: firstValidPoint.pos.y, z: firstValidPoint.height },
          _workspace: workspace.file.id
        };
      } else {
        // the first workspace doesn't have a valid point, just place the cube in space.
      }
    }
    this.fileManager.createFile(undefined, tags);
  }

  addNewWorkspace() {
    // TODO: Make the user have to drag a workspace onto the world
    // instead of just clicking a button and a workspace being placed somewhere.
    this.fileManager.createWorkspace();
  }

  toggleDebug() {
    this.debug = !this.debug;
  }

  setGridsVisible(visible: boolean) {
    this.getWorkspaces().forEach(workspace => {
      const mesh = <WorkspaceMesh>workspace.mesh;
      mesh.gridsVisible = visible;
    });
  }

  async mounted() {
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    window.addEventListener('vrdisplaypresentchange', this._handleResize);
    
    this._time = new Time();
    this.debugInfo = null;
    this._files = {};
    this._fileIds = {};
    this.recentFiles = [
      createFile()
    ];
    this._subs = [];
    this._setupScene();
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

    if (this.dev) {
      this.addSidebarItem('debug_mode', 'Debug', () => {
        this.toggleDebug();
      }, 'bug_report');
    }

    this._setupWebVR();
    await this._setupWebXR();
    this._frameUpdate();
  }

  beforeDestroy() {
    window.removeEventListener('resize', this._handleResize);
    window.removeEventListener('vrdisplaypresentchange', this._handleResize);
    this.removeSidebarItem('enable_xr');
    this.removeSidebarItem('disable_xr');
    this.removeSidebarItem('debug_mode');
    this._input.dispose();

    if (this._subs) {
      this._subs.forEach(sub => {
        sub.unsubscribe();
      });
      this._subs = [];
    }
  }

  private _frameUpdate(xrFrame?: any) {

    this._input.update();
    this._inputVR.update();
    this._interaction.update();

    for (let id in this._files) {
      const file = this._files[id];
      if (file) {
        file.frameUpdate();
      }
    }

    this._renderUpdate(xrFrame);

    // console.log(this._camera.position);

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

  /**
   * Returns the file id that is represented by the specified mesh id.
   * @param meshId The id of the mesh.
   */
  public getFileId(meshId: number): string {
    return this._fileIds[meshId];
  }

  /**
   * Returns the file that matches the specified file id.
   * @param fileId The id of the file.
   */
  public getFile(fileId: string): File3D {
    return this._files[fileId];
  }

  /**
   * Gets all of the files.
   */
  getFiles() {
    return values(this._files);
  }

  /**
   * Gets all of the objects.
   */
  getObjects() {
    return this.getFiles().filter(f => f.file.type === 'object');
  }

  /**
   * Gets all of the workspaces.
   */
  getWorkspaces() {
    return this.getFiles().filter(f => f.file.type === 'workspace');
  }

  /**
   * Toggles whether debug information is shown.
   */
  toggleDebugInfo() {
    this.showDebugInfo(!this._debug);
  }

  /**
   * Sets whether to show debug information.
   * @param debug Whether to show debug info.
   */
  showDebugInfo(debug: boolean) {
    this._debug = debug;
    this.getFiles().forEach(w => w.mesh.showDebugInfo(debug));
  }

  /**
   * Adds the given file to the recent files list.
   * If it already exists in the list then it will be moved to the front.
   * @param file The file to add to the list.
   * @param updateList Whether the list should be reordered.
   */
  addToRecentFilesList(file: Object, reorderList: boolean = false) {
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

  private async _fileUpdated(file: File, initialUpdate = false) {
    const obj = this._files[file.id];
    let shouldRemove = false;
    if (obj) {
      if (file.type === 'object') {
        
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
      } else if (file.type === 'workspace') {
        if (file.size <= 0) {
          shouldRemove = true;
        }
      }

      await obj.updateFile(file);
      this.onFileUpdated.invoke(obj);

      if (shouldRemove) {
        this._fileRemoved(file.id);
      }

    } else {
      console.log('cant find file to update it');
    }
  }

  private async _fileAdded(file: File) {
    if (file.type === 'object' && (file.tags._hidden || file.tags._destroyed) && !file.tags._user) {
      return;
    }
    
    var obj = new File3D(this, file);

    this._files[file.id] = obj;
    this._fileIds[obj.mesh.id] = obj.file.id;

    await this._fileUpdated(file, true);
    this.onFileAdded.invoke(obj);
  }

  private _fileRemoved(id: string) {
    const obj = this._files[id];
    if (obj) {
      delete this._fileIds[obj.mesh.id];
      delete this._files[id];
      obj.dispose();

      this.onFileRemoved.invoke(obj);
    }
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
    this._mainCamera.layers.enable(GameView.Layer_Default);

    // UI World camera.
    // This camera is parented to the main camera.
    this._uiWorldCamera = new PerspectiveCamera(this._mainCamera.fov, this._mainCamera.aspect, this._mainCamera.near, this._mainCamera.far);
    this._mainCamera.add(this._uiWorldCamera);
    this._uiWorldCamera.position.set(0,0,0);
    this._uiWorldCamera.rotation.set(0,0,0);

    // Ui World camera only draws objects on the 'UI World Layer'.
    this._uiWorldCamera.layers.set(GameView.Layer_UIWorld);

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

/**
 * Defines an interface for debug info that the game view has.
 */
export interface GameViewDebugInfo {
  workspaces: WorkspaceMeshDebugInfo[];
}