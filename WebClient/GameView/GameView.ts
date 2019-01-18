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
  Raycaster,
  MeshBasicMaterial,
  Object3D,
  LineBasicMaterial,
  PCFSoftShadowMap,
  BackSide,
  TextureLoader,
  OrbitControls,
  SphereBufferGeometry,
  BoxBufferGeometry,
  GLTFLoader,
  HemisphereLight,
} from 'three';
import 'three-examples/controls/OrbitControls';
import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject } from 'vue-property-decorator';
import {
  SubscriptionLike,
} from 'rxjs';

import { FileManager } from '../FileManager';
import { File, Object, Workspace } from 'common/Files';
import { time } from '../game-engine/Time';
import { Input } from '../game-engine/input';

import { vg } from "von-grid";

import skyTextureUrl from '../public/images/CGSkies_0132_free.jpg';
import groundModelUrl from '../public/models/ground.gltf';

import { 
  File3D
} from '../game-engine/Interfaces';
import { FileInteractionManager } from '../interaction/FileInteractionManager';
import { ArgEvent } from '../../common/Events';

@Component({
  inject: {
    fileManager: 'fileManager'
  }
})
export default class GameView extends Vue {

  @Inject() fileManager!: FileManager;

  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _cameraControls: OrbitControls;
  private _cameraControlsEnabled: boolean = true;
  private _renderer: Renderer;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _grids: Group;
  private _canvas: HTMLElement;
  private _input: Input;
  private _fileInteraction: FileInteractionManager;

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
  get camera(): PerspectiveCamera { return this._camera; }
  get grids(): Group { return this._grids; }
  get workspacePlane(): Mesh { return this._workspacePlane; }

  async mounted() {
    time.init();

    this._files = {};
    this._fileIds = {};
    this._subs = [];
    this._input = new Input();
    this._input.init(this.gameView);
    this._fileInteraction = new FileInteractionManager(this);
    this._setupScene();

    // Subscriptions to file events.
    this._subs.push(this.fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    }));
    this._subs.push(this.fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    }));
    this._subs.push(this.fileManager.fileUpdated.subscribe(file => {
      this._fileUpdated(file);
    }));

    this._frameUpdate();


    // const leftClickObjects = this._clickedObjects(isButton(mouseDown, 0));

    // this._subs.push(leftClickObjects.subscribe(intersection => {
    //   this._enableCameraControls(intersection === null);
    // }));

    // const rightClickObjects = this._clickedObjects(isButton(mouseDown, 2));
      
    // this._subs.push(rightClickObjects.subscribe(intersection => {
    //   this._enableCameraControls(intersection === null);
    // }));

    // const middleClickObjects = this._clickedObjects(isButton(mouseDown, 1));

    // this._subs.push(middleClickObjects.subscribe(() => {
    //   // Always allow camera control with middle clicks.
    //   this._enableCameraControls(true);
    // }));

    // const {
    //   dragOperations: leftDragOperations,
    //   clickOperations: leftClickOperations,
    //   gridsVisible
    // } = this._draggedObjects(leftDrag, leftClickObjects);

    // this._subs.push(leftDragOperations.subscribe(drag => {
    //   // console.log("[GameView] left drag operation frameCount: " + gameTime.frameCount + ", deltaTime: " + gameTime.deltaTime);
    //   this._handleDrag(drag.ray, drag.workspace, drag.hit);

    //   if (drag.justEndedClicking) {
    //     this._tryCombineFiles(drag);
    //   }
    // }));

    // this._subs.push(leftClickOperations.subscribe(click => {
    //   if(click.file !== null && click.file.file.type === 'object') {
    //     this._selectFile(click.file);
    //   }
    // }));

    // this._subs.push(gridsVisible.subscribe(visible => {
    //   this._grids.visible = visible;
    // }));
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

  // private _draggedObjects(observable: Observable<MouseDrag>, clicks: Observable<Intersection>) {
  //   const dragPositions: Observable<MouseDragPosition> = observable.pipe(
  //     map(drag => ({ ...drag, screenPos: Input.screenPosition(drag.event, this.gameView) })),
  //     map(drag => ({ ...drag, ray: Physics.screenPosToRay(drag.screenPos, this._camera) }))
  //   );

  //   const draggedObjects: Observable<DraggedObject> = combineLatest(
  //     clicks,
  //     dragPositions,
  //     (hit, drag) => ({
  //       ...drag,
  //       hit,
  //     })
  //   );

  //   const dragOperations: Observable<DragOperation> = draggedObjects.pipe(
  //     filter(drag => drag.isDragging && Input.eventIsDirectlyOverElement(drag.event, this._canvas)),
  //     map(drag => ({
  //       ...drag,
  //       workspace: this._findWorkspaceForIntersection(drag.hit),
  //     })),
  //     filter(drag => drag.hit !== null)
  //   );

  //   const clickOperations: Observable<ClickOperation> = dragPositions.pipe(
  //     filter(e => e.isClicking && Input.eventIsDirectlyOverElement(e.event, this._canvas)),
  //     map(e => ({...e, raycast: Physics.raycastAtScreenPos(e.screenPos, this._raycaster, this._draggableObjects, this._camera)})),
  //     map(e => ({...e, hit: Physics.firstRaycastHit(e.raycast)})),
  //     filter(e => e.hit !== null),
  //     map(e => ({...e, file: this._fileForIntersection(e.hit)})),
  //   );

  //   const gridsVisible = draggedObjects.pipe(
  //     map(drag => drag.isDragging && drag.hit !== null && this._isFile(drag.hit))
  //   );

  //   return {
  //     dragPositions,
  //     draggedObjects,
  //     dragOperations,
  //     clickOperations,
  //     gridsVisible
  //   };
  // }

  private _frameUpdate() {
    // console.log("game view update frame: " + time.frameCount);
    this._fileInteraction.update();
    this._renderer.render(this._scene, this._camera);

    requestAnimationFrame(() => this._frameUpdate());
  }

  public enableCameraControls(enabled: boolean) {
    if (this._cameraControls) {
      if (this._cameraControlsEnabled !== enabled) {
        this._cameraControlsEnabled = enabled;
        if (enabled) {
          // Camera controls are being enabled.
          var controls = <any>this._cameraControls;
          controls.panSpeed = 1.0;
          controls.rotateSpeed = 1.0;

          // Use the saved internal transform state to set the camera's initial transform state when re-enabling the controls.
          controls.target.copy(controls.target0);
          controls.object.position.copy(controls.position0);
          controls.object.zoom = controls.zoom0

          // controls.object.updateProjectionMatrix();
          // controls.update();
        }
        else {
          // Camera controls are being disabled.
          var controls = <any>this._cameraControls;
          controls.panSpeed = 0.0;
          controls.rotateSpeed = 0.0;

          // Tell orbit controls to save the internal transform state of the camera.
          controls.saveState();
        }
      }
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

  private _fileUpdated(file: File) {
    const obj = this._files[file.id];
    if (obj) {
      obj.file = file;
      if (file.type === 'object') {
        this._updateFile(obj, file);
      } else {
        this._updateWorkspace(obj, file);
      }

      this.onFileUpdated.invoke(obj);
    }
  }

  private _updateFile(obj: File3D, data: Object) {
    obj.mesh.visible = !data.tags._destroyed;
    const workspace = this._files[data.tags._workspace];
    obj.file = data;
    if (workspace) {
      obj.mesh.parent = workspace.mesh;
    } else {
      obj.mesh.parent = null;
    }

    if (data.tags.color) {
      const mesh = <Mesh>obj.mesh;
      const material = <MeshStandardMaterial>mesh.material;
      material.color = this._getColor(data.tags.color);
    } else {
      const mesh = <Mesh>obj.mesh;
      const material = <MeshStandardMaterial>mesh.material;
      material.color = new Color(0x00FF00);
    }

    if (data.tags._position) {
      obj.mesh.position.set(
        data.tags._position.x + 0,
        data.tags._position.y + 0.095,
        data.tags._position.z + 0);
    } else {
      // Default position
      obj.mesh.position.set(0, 1, 0);
    }
  }

  private _getColor(color: string): Color {
    return new Color(color);
  }

  private _updateWorkspace(obj: File3D, data: Workspace) {
    obj.mesh.position.x = obj.grid.group.position.x = data.position.x || 0;
    obj.mesh.position.y = obj.grid.group.position.y = data.position.y || 0;
    obj.mesh.position.z = obj.grid.group.position.z = data.position.z || 0;

    if (typeof data.size !== 'undefined' && obj.surface.grid.size !== data.size) {
      obj.surface.grid.cells = {};
      obj.surface.grid.numCells = 0;
      obj.surface.grid.generate({
        size: data.size || 0
      });
      this._generateTilemap(obj.surface, data);
      obj.surface.group.position.y -= .4;
    }

    obj.grid.group.position.y -= .45;
    obj.grid.group.updateMatrixWorld(false);
  }

  private _fileAdded(file: File) {
    console.log("File Added!");

    if (file.type === 'object' && file.tags._hidden) {
      return;
    }

    let mesh;
    let grid;
    let board;
    if (file.type === 'object') {
      const cube = this._createCube(0.2);
      mesh = cube;
    } else {
      const surface = this._createWorkSurface(file);
      mesh = surface.board.group;
      grid = surface.sqrBoard;
      board = surface.board;
    }
    const obj: File3D = this._files[file.id] = {
      file: file,
      grid: grid,
      surface: board,
      mesh: mesh
    };

    this._fileIds[obj.mesh.id] = obj.file.id;
    this._scene.add(obj.mesh);
    obj.mesh.name = `${file.type}_${file.id}`;
    if (grid) {
      grid.group.name = `grid_${file.type}_${file.id}`;
      this._fileIds[grid.group.id] = obj.file.id;
      this._grids.add(grid.group);
    }

    this.onFileAdded.invoke(obj);

    this._fileUpdated(file);
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

  private _createCube(size: number): Mesh {

    var geometry = new BoxBufferGeometry(size, size, size);
    var material = new MeshStandardMaterial({
      color: 0x00ff00,
      metalness: .1,
      roughness: 0.6
    });
    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
  }

  private _setupScene() {

    this._scene = new Scene();
    this._scene.background = new Color(0xCCE6FF);

    this._setupRenderer();

    // Grid group.
    this._grids = new Group();
    this._grids.visible = false;
    this._scene.add(this._grids);

    // User's camera
    this._camera = new PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 20000);
    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera.updateMatrixWorld(false);

    // this._cameraControls = new OrbitControls(this._camera, this._canvas);

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

  private _createWorkSurface(data: Workspace) {
    const grid = new vg.HexGrid({
      cellSize: .3,
      cellHeight: 0.5
    });
    grid.generate({
      size: data.size || 0
    });

    const board = new vg.Board(grid);
    this._generateTilemap(board, data);

    const sqrGrid = new vg.SqrGrid({
      size: 14,
      cellSize: .12
    });

    const sqrBoard = new vg.Board(sqrGrid);
    const mat = new LineBasicMaterial({
      color: 0xFFFFFF,
      opacity: 1
    });
    sqrBoard.generateOverlay(18, mat);

    sqrBoard.group.position.x = data.position.x;
    sqrBoard.group.position.y = data.position.y;
    sqrBoard.group.position.z = data.position.z;

    return { board, sqrBoard };
  }

  private _generateTilemap(board: vg.Board, data: Workspace) {
    board.generateTilemap({
      extrudeSettings: {
        bevelEnabled: true,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
      },
      material: new MeshStandardMaterial({
        color: 0x999999,
        roughness: .7,
      })
    });

    board.group.children[0].children.forEach(c => {
      c.castShadow = true;
      c.receiveShadow = true;
    });

    board.group.position.x = data.position.x;
    board.group.position.y = data.position.y + 0.4;
    board.group.position.z = data.position.z;
  }
};