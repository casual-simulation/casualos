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
  BoxGeometry
} from 'three';

import VRControlsModule from 'three-vrcontrols-module';
import VREffectModule from 'three-vreffect-module';
import VRController from 'three-vrcontroller-module';
import * as webvrui from 'webvr-ui';

import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';
import {
  concatMap, tap,
} from 'rxjs/operators';

import { File, Object, Workspace, DEFAULT_WORKSPACE_HEIGHT_INCREMENT, DEFAULT_USER_MODE, UserMode } from 'common/Files';
import { Time } from '../game-engine/Time';
import { Input } from '../game-engine/input';
import { File3D } from '../game-engine/File3D';

import skyTexturePath from '../public/images/CGSkies_0132_free.jpg';
import groundModelPath from '../public/models/ground.gltf';
import { appManager } from '../AppManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { ArgEvent } from '../../common/Events';
import { WorkspaceMesh, WorkspaceMeshDebugInfo } from '../game-engine/WorkspaceMesh';
import { GridChecker } from '../game-engine/grid/GridChecker';
import { FileMesh } from '../game-engine/FileMesh';
import { values, flatMap } from 'lodash';
import { getUserMode } from 'common/Files/FileCalculations';

@Component({
  components: {
  }
})
export default class GameView extends Vue {
  private _debug: boolean;
  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _renderer: WebGLRenderer;

  //
  // VR specific
  //
  private _vrDisplay: VRDisplay;
  private _enterVr: any;
  private _vrControls: any;
  private _vrEffect: any;
  private _vrControllers: any[];

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _canvas: HTMLElement;
  private _time: Time;
  private _input: Input;
  private _interaction: InteractionManager;
  private _gridChecker: GridChecker;

  public onFileAdded: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileUpdated: ArgEvent<File3D> = new ArgEvent<File3D>();
  public onFileRemoved: ArgEvent<File3D> = new ArgEvent<File3D>();

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

  @Watch('debug')
  debugChanged(val: boolean, previous: boolean) {
    this.showDebugInfo(val);
    this.updateDebugInfo();
  }

  updateDebugInfo() {
    this.getFiles().forEach(f => f.mesh.update());
    this.debugInfo = {
      workspaces: this.getWorkspaces().map(w => (<WorkspaceMesh>w.mesh).getDebugInfo())
    };
  }

  get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
  get time(): Time { return this._time; }
  get input(): Input { return this._input; }
  get interactionManager(): InteractionManager { return this._interaction; }
  get camera(): PerspectiveCamera { return this._camera; }
  get workspacePlane(): Mesh { return this._workspacePlane; }
  get scene(): Scene { return this._scene; }
  get renderer() { return this._renderer; } 
  get dev() { return !PRODUCTION; }
  get filesMode() { return this.mode === 'files'; }
  get workspacesMode() { return this.mode === 'worksurfaces'; }

  get gridChecker() { return this._gridChecker; }

  get fileManager() {
    return appManager.fileManager;
  }

  constructor() {
    super();
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
    this._subs = [];
    this._setupScene();
    this._input = new Input(this);
    this._interaction = new InteractionManager(this);
    this._gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

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
      }))
      .subscribe());

    this._setupWebVR();
    this._frameUpdate();
  }

  beforeDestroy() {
    window.removeEventListener('resize', this._handleResize);
    window.removeEventListener('vrdisplaypresentchange', this._handleResize);
    this._input.dispose();

    if (this._subs) {
      this._subs.forEach(sub => {
        sub.unsubscribe();
      });
      this._subs = [];
    }
  }

  private _frameUpdate() {

    this._input.update();
    this._interaction.update();
    VRController.update();

    if (this._vrDisplay && this._vrDisplay.isPresenting) {

      this._vrControls.update();
      this._renderer.render(this._scene, this._camera);
      this._vrEffect.render(this._scene, this._camera);

    } else {

      this._renderer.render(this._scene, this._camera);

    }

    this._time.update();

    if (this._vrDisplay && this._vrDisplay.isPresenting) {

      this._vrDisplay.requestAnimationFrame(() => this._frameUpdate());

    } else {

      requestAnimationFrame(() => this._frameUpdate());

    }
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

  private async _fileUpdated(file: File) {
    const obj = this._files[file.id];
    if (obj) {
      if (file.type === 'object') {
        if (file.tags._destroyed) {
          this._fileRemoved(file.id);
          return;
        }
      }
      await obj.updateFile(file);
      this.onFileUpdated.invoke(obj);
    } else {
      console.log('cant find file to update it');
    }
  }

  private async _fileAdded(file: File) {
    if (file.type === 'object' && (file.tags._hidden || file.tags._destroyed)) {
      return;
    }
    
    var obj = new File3D(this, file);

    this._files[file.id] = obj;
    this._fileIds[obj.mesh.id] = obj.file.id;

    await this._fileUpdated(file);
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
    this._scene.background = new Color(0xCCE6FF);

    
    // User's camera
    this._camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera.updateMatrixWorld(false);
    
    this._resizeCamera();
    this._setupRenderer();

    // Ambient light.
    this._ambient = new AmbientLight(0xffffff, 0.8);
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

    // Workspace plane.
    var gltfLoader = new GLTFLoader();
    gltfLoader.load(groundModelPath, gltf => {
      gltf.scene.traverse((child) => {
        if ((<any>child).isMesh) {
          console.log('[GameView] Assigned workspace plane mesh from gltf file.');
          this._workspacePlane = <Mesh>child;
          this._workspacePlane.castShadow = true;
          this._workspacePlane.receiveShadow = true;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.position.y = 0;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.rotation.x = ThreeMath.DEG2RAD * -90;
          this._workspacePlane.updateMatrixWorld(false);

          // Scale up the workspace plane.
          this._workspacePlane.scale.multiplyScalar(18000);

          this._scene.add(this._workspacePlane);
          return;
        }
      });
    });

    // Skydome
    const skydomeGeometry = new SphereBufferGeometry(9000, 64, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const skydomeTexture = new TextureLoader().load(skyTexturePath);
    const skydomeMaterial = new MeshBasicMaterial({
      side: BackSide,
      map: skydomeTexture,
    });

    this._skydome = new Mesh(skydomeGeometry, skydomeMaterial);
    this._skydome.castShadow = false;
    this._skydome.receiveShadow = false;
    this._skydome.position.set(0, 0, 0);

    this._scene.add(this._skydome);
  }

  private _setupRenderer() {

    const webGlRenderer = this._renderer = new WebGLRenderer({
      antialias: true,
    });
    webGlRenderer.shadowMap.enabled = true;
    webGlRenderer.shadowMap.type = PCFSoftShadowMap;

    this._resizeRenderer();
    this._canvas = this._renderer.domElement;
    this.gameView.appendChild(this._canvas);
  }
  
  private _setupWebVR() {

    let onBeforeEnter = () => {
      console.log("[GameView] vr on before enter");

      this._renderer.vr.enabled = true;

      // VR controls
      this._vrControls = new VRControlsModule(this._camera);
      this._vrControls.standing = true;
  
      // Create VR Effect rendering in stereoscopic mode
      this._vrEffect = new VREffectModule(this._renderer);
      this._resizeVR();
      this._renderer.setPixelRatio(Math.floor(window.devicePixelRatio));

      return new Promise((resolve, reject) => {
        resolve(null);
      });
    };

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

    
    // Lisen for vr controllers connecting.
    VRController.verbosity = 1.0;
    this._vrControllers = [];
    this._handleVRControllerConnected = this._handleVRControllerConnected.bind(this);
    window.addEventListener('vr controller connected', this._handleVRControllerConnected);

    let vrButtonContainer = document.getElementById('vr-button-container');
    vrButtonContainer.appendChild(this._enterVr.domElement);
  }

  private _handleReadyVR(display: VRDisplay) {
    
    console.log("[GameView] vr display is ready.");
    console.log(display);
    this._vrDisplay = display;
  }

  private _handleEnterVR(display: any) {

    console.log('[GameView] enter vr.');
    console.log(display);
    this._vrDisplay = display;
  }

  private _handleExitVR(display: any) {
    
    console.log('[GameView] exit vr.');
    console.log(display);

    this._renderer.vr.enabled = false;

    this._vrControls.dispose();
    this._vrControls = null;

    this._vrEffect.dispose();
    this._vrControls = null; 
    
    // reset camera back to default position.
    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera.updateMatrixWorld(false);
  }

  private _handleErrorVR(error: any) {
    // console.error('error vr');
    // console.error(error);
  }

  private _handleVRControllerConnected(event: any) {
    console.log("[GameView] VR Controller connected:");
    console.log(event);
    
    let controller = event.detail;
    
    if(this._vrControllers) this._vrControllers = [];
    this._vrControllers.push(controller);

    // Controller is an Object3D. Lets add it to the scene.
    this._scene.add(controller);
    
    controller.standingMatrix = (<any>this._renderer.vr).getStandingMatrix();
    console.log('standing matrix:');
    console.log(controller.standingMatrix);
    controller.head = this._camera;
    console.log('head:');
    console.log(controller.head);

    //  Right now your controller has no visual.
    //  It’s just an empty THREE.Object3D.
    //  Let’s fix that!
    let meshColorOff = 0xDB3236; //  Red.
    let meshColorOn  = 0xF4C20D; //  Yellow.
    let controllerMaterial = new MeshStandardMaterial({
      color: meshColorOff
    });
    let controllerMesh = new Mesh(
      new CylinderGeometry( 0.005, 0.05, 0.1, 6 ),
      controllerMaterial
    );
    let handleMesh = new Mesh(
      new BoxGeometry( 0.03, 0.1, 0.03 ),
      controllerMaterial
    );
    controllerMaterial.flatShading = true;
    controllerMesh.rotation.x = -Math.PI / 2;
    handleMesh.position.y = -0.05;
    controllerMesh.add(handleMesh);
    controller.userData.mesh = controllerMesh;//  So we can change the color later.
    controller.add(controllerMesh);

    controller.addEventListener('disconnected', (event: any) => {
      console.log("[GameView] VR controller disconnected:");
      console.log(event);

      let index = this._vrControllers.indexOf(controller);
      if (index >= 0) {
        this._vrControllers.slice(index, 1);
      }

      this._scene.remove(controller);
    });
  }

  private _handleResize() {
    this._resizeCamera();
    this._resizeRenderer();
    this._resizeVR();
  }

  private _resizeRenderer() {
    // TODO: Call each time the screen size changes
    const { width, height } = this._calculateSize();
    this._renderer.setSize(width, height);
    this._container.style.height = this._renderer.domElement.style.height;
  }

  private _resizeCamera() {
    const { width, height } = this._calculateSize();
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }

  private _resizeVR() {
    if (!this._vrEffect) return;

    const { width, height } = this._calculateSize();
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