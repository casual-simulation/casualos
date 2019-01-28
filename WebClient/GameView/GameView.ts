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
} from 'three';
import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Prop, Watch } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';

import { File, Object, Workspace, DEFAULT_WORKSPACE_HEIGHT_INCREMENT } from 'common/Files';
import { time } from '../game-engine/Time';
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
import CubeIcon from './Cube.svg';

@Component({
  components: {
    'cube-icon': CubeIcon,
  }
})
export default class GameView extends Vue {
  private _debug: boolean;
  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _renderer: Renderer;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _canvas: HTMLElement;
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
  get input(): Input { return this._input; }
  get interactionManager(): InteractionManager { return this._interaction; }
  get camera(): PerspectiveCamera { return this._camera; }
  get workspacePlane(): Mesh { return this._workspacePlane; }
  get scene(): Scene { return this._scene; }
  get dev() { return !PRODUCTION; }

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

    time.init();

    this.debugInfo = null;
    this._files = {};
    this._fileIds = {};
    this._subs = [];
    this._setupScene();
    this._input = new Input();
    this._input.init(this.gameView);
    this._interaction = new InteractionManager(this);
    this._gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

    // Subscriptions to file events.
    this._subs.push(this.fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    }));
    this._subs.push(this.fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    }));
    this._subs.push(this.fileManager.fileUpdated.subscribe(async file => {
      await this._fileUpdated(file);
    }));

    this._frameUpdate();
  }

  beforeDestroy() {
    this._input.terminate();

    if (this._subs) {
      this._subs.forEach(sub => {
        sub.unsubscribe();
      });
      this._subs = [];
    }
  }

  private _frameUpdate() {
    // console.log("game view update frame: " + time.frameCount);
    this._interaction.update();
    this._renderer.render(this._scene, this._camera);

    requestAnimationFrame(() => this._frameUpdate());
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
      obj.updateFile(file);
      this.onFileUpdated.invoke(obj);
    } else {
      console.log('cant find file to update it');
    }
  }

  private async _fileAdded(file: File) {
    console.log("File Added!");
    if (file.type === 'object' && file.tags._hidden) {
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

    this._setupRenderer();

    // User's camera
    this._camera = new PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 20000);
    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera.updateMatrixWorld(false);

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

    // TODO: Call each time the screen size changes
    const container: HTMLElement = <HTMLElement>this.$refs.container;
    const width = window.innerWidth;
    const height = window.innerHeight - container.getBoundingClientRect().top;
    this._renderer.setSize(width, height);
    container.style.height = this._renderer.domElement.style.height;

    this._canvas = this._renderer.domElement;
    this.gameView.appendChild(this._canvas);
  }
};

/**
 * Defines an interface for debug info that the game view has.
 */
export interface GameViewDebugInfo {
  workspaces: WorkspaceMeshDebugInfo[];
}