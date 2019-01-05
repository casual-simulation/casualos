import {
  Scene,
  Camera,
  Renderer,
  Clock,
  Mesh,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Vector3,
  Vector2,
  Math as ThreeMath,
  Group,
  Raycaster,
  Intersection,
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
  Observable,
  fromEvent,
  combineLatest,
} from 'rxjs';
import {
  filter,
  map,
  tap,
  scan,
} from 'rxjs/operators';


import { FileManager } from '../FileManager';
import { File, Object, Workspace } from 'common';

import { vg } from "von-grid";

import skyTextureUrl from '../public/images/CGSkies_0132_free.jpg';
import groundModelUrl from '../public/models/ground.gltf';
import { 
  isButton, 
  mouseDown, 
  leftDrag, 
  rightDrag, 
  showHideContextMenu,
  screenPosToRay, 
  eventIsDirectlyOverElement, 
  firstRaycastHit,
  screenPosition,
  raycastAtScreenPos,
  pointOnPlane,
  pointOnRay,
  Ray,
  File3D,
  MouseDrag, 
  ClickOperation,
  DragOperation,
  MouseDragPosition,
  DraggedObject,
  disableContextMenuWithin,
  EventWrapper,
  ContextMenuEvent,
  ContextMenuOperation,
  eventIsOverElement,
} from '../Input';

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
  private _raycaster: Raycaster;
  private _clock: Clock;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _draggableObjects: Object3D[];
  private _grids: Group;
  private _canvas: HTMLElement;

  /**
   * A map of file IDs to files and meshes.
   */
  private _files: {
    [id: string]: File3D
  } = {};

  /**
   * A map of mesh IDs to file IDs.
   */
  private _meshses: {
    [mesh: number]: string
  } = {};

  private _frames: number;

  private _subs: SubscriptionLike[];

  get gameView() {
    const gameView: HTMLElement = <HTMLElement>this.$refs.gameView;
    return gameView;
  }

  async mounted() {
    this._files = {};
    this._meshses = {};
    this._draggableObjects = [];
    this._subs = [];
    this._setupScene();

    this._clock.start();
    this._frames = 0;
    this._renderGame();

    this._subs.push(this.fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    }));
    this._subs.push(this.fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    }));
    this._subs.push(this.fileManager.fileUpdated.subscribe(file => {
      this._fileUpdated(file);
    }));

    const leftClickObjects = this._clickedObjects(isButton(mouseDown, 0));

    this._subs.push(leftClickObjects.subscribe(intersection => {
      this.enableCameraControls(intersection === null);
    }));

    const rightClickObjects = this._clickedObjects(isButton(mouseDown, 2));
      
    this._subs.push(rightClickObjects.subscribe(intersection => {
      this.enableCameraControls(intersection === null);
    }));

    const middleClickObjects = this._clickedObjects(isButton(mouseDown, 1));

    this._subs.push(middleClickObjects.subscribe(() => {
      // Always allow camera control with middle clicks.
      this.enableCameraControls(true);
    }));

    const {
      dragOperations: leftDragOperations,
      clickOperations: leftClickOperations,
      gridsVisible
    } = this._draggedObjects(leftDrag, leftClickObjects);

    this._subs.push(leftDragOperations.subscribe(drag => {
      this._handleDrag(drag.ray, drag.workspace, drag.hit);
    }));

    this._subs.push(leftClickOperations.subscribe(click => {
      if(click.file !== null && click.file.file.type === 'object') {
        this._selectFile(click.file);
      }
    }));

    this._subs.push(gridsVisible.subscribe(visible => {
      this._grids.visible = visible;
    }));

    const contextMenuEvents: Observable<ContextMenuOperation> = showHideContextMenu.pipe(
      map(e => ({ ...e, screenPos: screenPosition(e.event, this.gameView) })),
      map(e => ({ ...e, ray: screenPosToRay(e.screenPos, this._camera) })),
      filter(e => eventIsOverElement(e.event, this._canvas)),
      map(e => ({...e, raycast: raycastAtScreenPos(e.screenPos, this._raycaster, this._draggableObjects, this._camera)})),
      map(e => ({...e, hit: firstRaycastHit(e.raycast)})),
      map(e => ({...e, file: e.hit ? this._fileForIntersection(e.hit) : null})),
    );

    this._subs.push(contextMenuEvents.subscribe(click => {
      this._contextMenuClick(click);
    }));

    this._subs.push(disableContextMenuWithin(this.gameView));
  }

  beforeDestroy() {
    if (this._subs) {
      this._subs.forEach(sub => {
        sub.unsubscribe();
      });
      this._subs = [];
    }
  }

  private _draggedObjects(observable: Observable<MouseDrag>, clicks: Observable<Intersection>) {
    const dragPositions: Observable<MouseDragPosition> = observable.pipe(
      map(drag => ({ ...drag, screenPos: screenPosition(drag.event, this.gameView) })),
      map(drag => ({ ...drag, ray: screenPosToRay(drag.screenPos, this._camera) }))
    );

    const draggedObjects: Observable<DraggedObject> = combineLatest(
      clicks,
      dragPositions,
      (hit, drag) => ({
        ...drag,
        hit,
      })
    );

    const dragOperations: Observable<DragOperation> = draggedObjects.pipe(
      filter(drag => drag.isDragging && eventIsDirectlyOverElement(drag.event, this._canvas)),
      map(drag => ({
        ...drag,
        workspace: this._findWorkspaceForIntersection(drag.hit),
      })),
      filter(drag => drag.hit !== null)
    );

    const clickOperations: Observable<ClickOperation> = dragPositions.pipe(
      filter(e => e.isClicking && eventIsDirectlyOverElement(e.event, this._canvas)),
      map(e => ({...e, raycast: raycastAtScreenPos(e.screenPos, this._raycaster, this._draggableObjects, this._camera)})),
      map(e => ({...e, hit: firstRaycastHit(e.raycast)})),
      filter(e => e.hit !== null),
      map(e => ({...e, file: this._fileForIntersection(e.hit)})),
    );

    const gridsVisible = draggedObjects.pipe(
      map(drag => drag.isDragging && drag.hit !== null && this._isFile(drag.hit))
    );

    return {
      dragPositions,
      draggedObjects,
      dragOperations,
      clickOperations,
      gridsVisible
    };
  }

  private _clickedObjects(observable: Observable<MouseEvent>) {
    return observable.pipe(
      filter(e => eventIsDirectlyOverElement(e, this._canvas)),
      map(e => screenPosition(e, this.gameView)),
      map(pos => raycastAtScreenPos(pos, this._raycaster, this._draggableObjects, this._camera)),
      map(r => firstRaycastHit(r)),
    );
  }

  private _isFile(hit: Intersection): boolean {
    return this._findWorkspaceForIntersection(hit) === null;
  }

  private _handleDrag(mouseDir: Ray, workspace: File3D, hit: Intersection) {
    if (workspace) {
      this._dragWorkspace(mouseDir, workspace);
    } else {
      this._dragFile(mouseDir, hit);
    }
  }

  private enableCameraControls(enabled: boolean) {
    if (this._cameraControls !== null) {
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

  private _dragWorkspace(mouseDir: Ray, workspace: File3D) {
    const point = pointOnPlane(mouseDir, this._workspacePlane);
    if (point) {
      this.fileManager.updateFile(workspace.file, {
        position: {
          x: point.x,
          y: point.y,
          z: point.z
        }
      });
    }
  }

  private _contextMenuClick(event: ContextMenuOperation) {
    if (!event.file || event.file.file.type === 'workspace') {
      this.$emit('onContextMenu', event);
    }
  }

  private _selectFile(file: File3D) {
    this.fileManager.selectFile(<Object>file.file);
  }

  private _dragFile(mouseDir: Ray, hit: Intersection) {
    const { good, point, workspace } = this._pointOnGrid(mouseDir);
    const file = this._fileForIntersection(hit);
    if (file) {
      if (good) {
        this.fileManager.updateFile(file.file, {
          tags: {
            _workspace: workspace.file.id,
            _position: {
              x: point.x,
              y: point.y,
              z: point.z
            }
          }
        });
      } else {
        const p = pointOnRay(mouseDir, 2);
        this.fileManager.updateFile(file.file, {
          tags: {
            _workspace: null,
            _position: {
              x: p.x,
              y: p.y,
              z: p.z
            }
          }
        });
      }
    }
  }

  private _fileForIntersection(hit: Intersection): File3D {
    const id = this._meshses[hit.object.id];
    if (id) {
      return this._files[id];
    } else {
      return this._findWorkspaceForIntersection(hit);
    }
  }

  private _pointOnGrid(ray: Ray) {
    const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
    raycaster.linePrecision = .1;
    const hits = raycaster.intersectObject(this._grids, true);
    const hit = hits[0];
    if (hit) {
      const point = hit.point;
      const workspace = this._findWorkspaceForIntersection(hit);
      if (workspace) {
        workspace.mesh.worldToLocal(point);
        const cell = workspace.grid.grid.pixelToCell(point);
        const pos = workspace.grid.grid.cellToPixel(cell).clone();
        pos.y = point.y;
        return {
          good: true,
          point: pos,
          workspace
        };
      }
    }
    return {
      good: false
    };
  }

  private _findWorkspaceForIntersection(obj: Intersection): File3D | null {
    if (!obj) {
      return null;
    }
    const hasParent = !!obj.object.parent && !!obj.object.parent.parent;
    const fileId = hasParent ? this._meshses[obj.object.parent.parent.id] : null;
    const file = fileId ? this._files[fileId] : null;
    if (file && file.file.type === 'workspace') {
      return file;
    } else {
      return null;
    }
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
    }
  }

  private _updateFile(obj: File3D, data: Object) {
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
    const obj = this._files[file.id] = {
      file: file,
      grid: grid,
      surface: board,
      mesh: mesh
    };

    this._meshses[obj.mesh.id] = obj.file.id;
    this._draggableObjects.push(obj.mesh);
    this._scene.add(obj.mesh);
    obj.mesh.name = `${file.type}_${file.id}`;
    if (grid) {
      grid.group.name = `grid_${file.type}_${file.id}`;
      this._meshses[grid.group.id] = obj.file.id;
      this._grids.add(grid.group);
    }

    this._fileUpdated(file);
  }

  private _fileRemoved(id: string) {
    const obj = this._files[id];
    if (obj) {
      delete this._meshses[obj.mesh.id];
      delete this._files[id];
      this._scene.remove(obj.mesh);
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

    this._raycaster = new Raycaster();
    this._clock = new Clock();

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

    this._cameraControls = new OrbitControls(this._camera, this._canvas);

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

  private _renderGame() {
    this._frames += 1;
    requestAnimationFrame(() => this._renderGame());

    const deltaTime = this._clock.getDelta();

    this._updateGame();

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame() {
  }

};