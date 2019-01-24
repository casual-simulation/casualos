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
  LineBasicMaterial,
  PCFSoftShadowMap,
  BackSide,
  TextureLoader,
  SphereBufferGeometry,
  BoxBufferGeometry,
  GLTFLoader,
  HemisphereLight,
} from 'three';
import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';

import { File, Object, Workspace } from 'common/Files';
import { time } from '../game-engine/Time';
import { Input } from '../game-engine/input';

import { vg } from "von-grid";

import skyTextureUrl from '../public/images/CGSkies_0132_free.jpg';
import groundModelUrl from '../public/models/ground.gltf';
import { appManager } from '../AppManager';
import { File3D } from '../game-engine/Interfaces';
import { InteractionManager } from '../interaction/InteractionManager';
import { ArgEvent } from '../../common/Events';
import { WorkspaceMesh } from '../game-engine/WorkspaceMesh';
import { GridChecker } from '../game-engine/grid/GridChecker';
import { FileMesh } from '../game-engine/FileMesh';
import { values } from 'lodash';

@Component({
})
export default class GameView extends Vue {

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

  get gameView(): HTMLElement { return <HTMLElement>this.$refs.gameView; }
  get input(): Input { return this._input; }
  get interactionManager(): InteractionManager { return this._interaction; }
  get camera(): PerspectiveCamera { return this._camera; }
  get workspacePlane(): Mesh { return this._workspacePlane; }
  get files() { return values(this._files); }

  get fileManager() {
    return appManager.fileManager;
  }

  async mounted() {
    time.init();

    this._files = {};
    this._fileIds = {};
    this._subs = [];
    this._setupScene();
    this._input = new Input();
    this._input.init(this.gameView);
    this._interaction = new InteractionManager(this);
    this._gridChecker = new GridChecker();

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

  private async _fileUpdated(file: File) {
    const obj = this._files[file.id];
    if (obj) {
      obj.file = file;
      if (file.type === 'object') {
        this._updateFile(obj, file);
      } else {
        await this._updateWorkspace(obj, file);
      }

      this.onFileUpdated.invoke(obj);
    }
  }

  private _updateFile(obj: File3D, data: Object) {

    const file = <FileMesh>obj.mesh;
    file.update(data);
  }

  private async _updateWorkspace(obj: File3D, data: Workspace) {
    const workspaceMesh = <WorkspaceMesh> obj.mesh;
    await workspaceMesh.update(data, this._gridChecker);

    // if (typeof data.size !== 'undefined' && obj.surface.grid.size !== data.size) {
    //   obj.surface.grid.cells = {};
    //   obj.surface.grid.numCells = 0;
    //   obj.surface.grid.generate({
    //     size: data.size || 0
    //   });
    //   this._generateTilemap(obj.surface, data);
    //   obj.surface.group.position.y -= .4;
    // }

    // obj.grid.group.position.y -= .45;
    // obj.grid.group.updateMatrixWorld(false);
  }

  private async _fileAdded(file: File) {
    console.log("File Added!");

    if (file.type === 'object' && file.tags._hidden) {
      return;
    }

    let obj: File3D;
    if (file.type === 'object') {
      obj = this._createFile(file);
      // const cube = this._createCube(0.2);
      // mesh = cube;
    } else {
      obj = this._createWorkSurface(file);
      // const surface = this._createWorkSurface(file);
      // mesh = surface.board.group;
      // grid = surface.sqrBoard;
      // board = surface.board;
    }
    // const obj: File3D = this._files[file.id] = {
    //   file: file,
    //   grid: grid,
    //   surface: board,
    //   mesh: mesh
    // };

    this._files[file.id] = obj;
    this._fileIds[obj.mesh.id] = obj.file.id;
    this._scene.add(obj.mesh);
    obj.mesh.name = `${file.type}_${file.id}`;

    await this._fileUpdated(file);
    this.onFileAdded.invoke(obj);
  }

  private _fileRemoved(id: string) {
    const obj = this._files[id];
    if (obj) {
      delete this._fileIds[obj.mesh.id];
      delete this._files[id];
      this._scene.remove(obj.mesh);

      this.onFileRemoved.invoke(obj);
    }
  }

  private _createFile(file: File): File3D {
    return {
      file: file,
      // TODO: 
      mesh: new FileMesh(this)
    };
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
    gltfLoader.load(groundModelUrl, gltf => {
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
    const skydomeTexture = new TextureLoader().load(skyTextureUrl);
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

  private _createWorkSurface(data: Workspace): File3D {
    return {
      file: data,
      mesh: new WorkspaceMesh()
    };

    // const grid = new vg.HexGrid({
    //   cellSize: .3,
    //   cellHeight: 0.5
    // });
    // grid.generate({
    //   size: data.size || 0
    // });

    // const board = new vg.Board(grid);
    // this._generateTilemap(board, data);

    // const sqrGrid = new vg.SqrGrid({
    //   size: 14,
    //   cellSize: .12
    // });

    // const sqrBoard = new vg.Board(sqrGrid);
    // const mat = new LineBasicMaterial({
    //   color: 0xFFFFFF,
    //   opacity: 1
    // });
    // sqrBoard.generateOverlay(18, mat);

    // sqrBoard.group.position.x = data.position.x;
    // sqrBoard.group.position.y = data.position.y;
    // sqrBoard.group.position.z = data.position.z;

    // return { board, sqrBoard };
  }

  // private _generateTilemap(board: vg.Board, data: Workspace) {
  //   board.generateTilemap({
  //     extrudeSettings: {
  //       bevelEnabled: true,
  //       steps: 1,
  //       bevelSize: 0.015,
  //       bevelThickness: 0.00
  //     },
  //     material: new MeshStandardMaterial({
  //       color: 0x999999,
  //       roughness: .7,
  //     })
  //   });

  //   board.group.children[0].children.forEach(c => {
  //     c.castShadow = true;
  //     c.receiveShadow = true;
  //   });

  //   board.group.position.x = data.position.x;
  //   board.group.position.y = data.position.y + 0.4;
  //   board.group.position.z = data.position.z;
  // }
};