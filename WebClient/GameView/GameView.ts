import { 
  Scene,
  Camera, 
  Renderer, 
  Clock, 
  Mesh, 
  Light,
  Color,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
  Vector2,
  Math,
  Group,
  Raycaster,
  Intersection,
  Plane,
  PlaneGeometry,
  MeshBasicMaterial,
  Object3D,
  LineBasicMaterial,
  PCFSoftShadowMap,
  Material,
} from 'three';
import Vue, {ComponentOptions} from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject } from 'vue-property-decorator';
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

import {merge} from 'lodash';

import {appManager} from '../AppManager';
import {FileManager} from '../FileManager';
import {File, Object, Workspace} from 'common';

import { vg } from "von-grid";

interface Ray {
  origin: Vector3;
  direction: Vector3;
}

interface File3D {
  mesh: Mesh | Group;
  surface: vg.Board;
  grid: vg.Board;
  file: File;
}

const mouseUp = fromEvent<MouseEvent>(document, 'mouseup');
const mouseDown = fromEvent<MouseEvent>(document, 'mousedown');
const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');

function isButton(observable: Observable<MouseEvent>, button: number): Observable<MouseEvent> {
  return observable.pipe(
    filter(e => e.button === button)
  )
}

function buttonActive(button: number): Observable<boolean> {
  const clickUp = isButton(mouseUp, button);
  const clickDown = isButton(mouseDown, button);

  const active = combineLatest(
    clickUp,
    clickDown,
    (e1, e2) => e2.timeStamp > e1.timeStamp
  );  

  return active;
}

const leftClickActive = buttonActive(0);
const rightClickActive = buttonActive(1);

/**
 * Returns an observable that is able to signal
 * when the given observable goes from false to true values (rising edge)
 * and also when it goes from true back to false. (falling edge)
 */
function detectEdges(observable: Observable<boolean>) {
  return observable.pipe(
    map(a => ({
      active: a,
      started: false,
      ended: false,
      startTime: null,
      endTime: null
    })),
    scan((prev, curr) => {
      if(!prev.active && curr.active) {
        return {
          active: curr.active,
          started: true,
          ended: false,
          startTime: Date.now(),
          endTime: null
        };
      } else if(prev.active && !curr.active) {
        return {
          active: curr.active,
          started: false,
          ended: true,
          startTime: curr.startTime,
          endTime: Date.now()
        };
      } else {
        return {
          ...curr,
          started: false,
          ended: false
        };
      }
    }, { active: false, started: false, ended: false, startTime: <number>null, endTime: <number>null }),
  );
}

function mouseDistance(first: MouseEvent, second: MouseEvent) {
  const pos1 = new Vector2(first.pageX, first.pageY);
  const pos2 = new Vector2(second.pageX, second.pageY);
  return pos1.distanceTo(pos2);
}

function buttonDrag(active: Observable<boolean>) {
  active = combineLatest(
    active,
    mouseMove,
    (active, move) => active
  );
  const dragging = detectEdges(active);
  return combineLatest(
    dragging,
    mouseMove,
    (active, mouse) => ({
      isActive: active.active,
      justStartedClicking: active.started,
      startDragTime: active.startTime,
      justEndedClicking: active.ended,
      endDragTime: active.endTime,
      event: mouse,
      startClickEvent: null
    })
  ).pipe(
    scan((prev, curr) => {
      if(curr.justStartedClicking) {
        return {
          ...curr,
          startClickEvent: curr.event
        }
      } else {
        return {
          ...curr,
          startClickEvent: prev.startClickEvent
        };
      }
    }, {
      isActive: false,
      justStartedClicking: false,
      startDragTime: <number>null,
      justEndedClicking: false,
      endDragTime: <number>null,
      event: null,
      startClickEvent: null
    }),
    map(event => {
      const wasDragging = event.startClickEvent && mouseDistance(event.startClickEvent, event.event) > 10;
      const isDragging = event.isActive && wasDragging;
      const isClicking = !isDragging && !wasDragging && event.justEndedClicking;
      return {
        ...event,
        isDragging,
        isClicking
      }
    })
  );
}

function buttonClick() {
  return mouseUp;
}

const leftDrag = buttonDrag(leftClickActive);
const rightDrag = buttonDrag(rightClickActive);

function screenPosition(event: MouseEvent, view: HTMLElement) {
  const globalPos = new Vector2(event.pageX, event.pageY);
  const viewRect = view.getBoundingClientRect();
  const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
  return new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
}

interface RaycastTest {
  mouse: Vector2;
  intersects: Intersection[];
}

function raycastAtScreenPos(pos: Vector2, raycaster: Raycaster, objects: Object3D[], camera: Camera) {
  raycaster.setFromCamera(pos, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  return {
    mouse: pos,
    intersects
  };
}

function isRaycastSuccess(test: RaycastTest) {
  return test.intersects.length > 0
}

function firstRaycastHit(test: RaycastTest) {
  return test.intersects.length > 0 ? test.intersects[0] : null;
}

function screenPosToRay(pos: Vector2, camera: Camera) {
  const v3d = new Vector3(pos.x, pos.y, 0.5);

  v3d.unproject(camera);

  v3d.sub(camera.position);
  v3d.normalize();
  
  return {
    origin: camera.position,
    direction: v3d
  };
}

function pointOnRay(ray: Ray, distance: number): Vector3 {
  let pos = new Vector3(ray.direction.x, ray.direction.y, ray.direction.z);
  pos.multiplyScalar(distance);
  pos.add(ray.origin);

  return pos;
}

function pointOnPlane(ray: Ray, plane: Mesh): Vector3 | null {
  const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
  const hits = raycaster.intersectObject(plane, true);
  return hits.length > 0 ? hits[0].point : null;
}

function eventIsOverElement(event: MouseEvent, element: HTMLElement): boolean {
  const mouseOver = document.elementFromPoint(event.clientX, event.clientY);
  return mouseOver === element;
}

@Component({
  inject: {
    fileManager: 'fileManager'
  }
})
export default class GameView extends Vue {

  @Inject() fileManager!: FileManager;

  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _renderer: Renderer;
  private _raycaster: Raycaster;
  private _clock: Clock;

  private _sun: Light;
  private _ambient: Light;

  private _cube: Mesh;
  private _workspacePlane: Mesh;
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

  private _sub: SubscriptionLike;

  get gameView() {
    const gameView: HTMLElement = <HTMLElement>this.$refs.gameView;
    return gameView;
  }

  async mounted() {
    this._files = {};
    this._meshses = {};
    this._draggableObjects = [];
    this._setupScene();

    this._clock.start();
    this._frames = 0;
    this._renderGame();

    this.fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    });
    this.fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    });
    this.fileManager.fileUpdated.subscribe(file => {
      this._fileUpdated(file);
    });

    const selectedObjects = isButton(mouseDown, 0)
      .pipe(
        filter(e => eventIsOverElement(e, this._canvas)),
        map(e => screenPosition(e, this.gameView)),
        map(pos => raycastAtScreenPos(pos, this._raycaster, this._draggableObjects, this._camera)),
        map(r => firstRaycastHit(r)),
      );
    
    const dragPositions = leftDrag.pipe(
      map(drag => ({...drag, screenPos: screenPosition(drag.event, this.gameView)})),
      map(drag => ({...drag, ray: screenPosToRay(drag.screenPos, this._camera)}))
    );

    const draggedObjects = combineLatest(
      selectedObjects,
      dragPositions,
      (hit, drag) => ({
        ...drag,
        hit,
      })
    );

    const dragOperations = draggedObjects.pipe(
      filter(drag => drag.isDragging && eventIsOverElement(drag.event, this._canvas)),
      map(drag => ({
        ...drag,
        workspace: this._findWorkspaceForIntersection(drag.hit),
      })),
      filter(drag => drag.hit !== null)
    );

    const clickOperations = dragPositions.pipe(
      filter(e => e.isClicking && eventIsOverElement(e.event, this._canvas)),
      map(e => screenPosition(e.event, this.gameView)),
      map(pos => raycastAtScreenPos(pos, this._raycaster, this._draggableObjects, this._camera)),
      map(r => firstRaycastHit(r)),
      filter(hit => hit !== null),
      map(hit => this._fileForMesh(hit.object)),
      filter(file => file !== null && file.file.type === 'object'),
      tap(file => this._selectFile(file))
    )

    dragOperations.subscribe(drag => {
      this._handleDrag(drag.ray, drag.workspace, drag.hit);
    });

    clickOperations.subscribe();

    const gridsVisible = draggedObjects.pipe(
      map(drag => drag.isDragging && drag.hit !== null && this._isFile(drag.hit)),
      tap(visible => this._grids.visible = visible)
    );

    gridsVisible.subscribe();
  }

  beforeDestroy() {
    if(this._sub) {
      this._sub.unsubscribe();
      this._sub = null;
    }
  }

  private _isFile(hit: Intersection): boolean {
    return  this._findWorkspaceForIntersection(hit) === null;
  }

  private _handleDrag(mouseDir: Ray, workspace: File3D, hit: Intersection) {
    if (workspace) {
      this._dragWorkspace(mouseDir, workspace);
    } else {
      this._dragFile(mouseDir, hit);
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

  private _selectFile(file: File3D) {
    this.fileManager.selectFile(file.file);
  }

  private _dragFile(mouseDir: Ray, hit: Intersection) {
    const { good, point, workspace } = this._pointOnGrid(mouseDir);
    const file = this._fileForMesh(hit.object);
    if (good) {
      this.fileManager.updateFile(file.file, {
        workspace: workspace.file.id,
        position: {
          x: point.x,
          y: point.y,
          z: point.z
        }
      });
    } else {
      const p = pointOnRay(mouseDir, 2);
      this.fileManager.updateFile(file.file, {
        workspace: null,
        position: {
          x: p.x,
          y: p.y,
          z: p.z
        }
      });
    }
  }

  private _fileForMesh(mesh: Object3D): File3D {
    const id = this._meshses[mesh.id];
    if (id) {
      return this._files[id];
    } else {
      return null;
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
    if(file.type === 'object') {
      this._updateFile(obj, file);
    } else {
      this._updateWorkspace(obj, file);
    }
  }

  private _updateFile(obj: File3D, data: Object) {
    const workspace = this._files[data.workspace];
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

    if (data.position) {
        obj.mesh.position.set(
          data.position.x + 0,
          data.position.y + 0.095,
          data.position.z + 0);
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

    obj.grid.group.position.y -= .45;
    obj.grid.group.updateMatrixWorld(false);
  }

  private _fileAdded(file: File) {
    console.log("File Added!");
    let mesh;
    let grid;
    let board;
    if(file.type === 'object') {
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
    if (grid) {
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
    
    var geometry = new BoxGeometry(size, size, size);
    var material = new MeshStandardMaterial(
        {color: 0x00ff00, metalness: 0, roughness: 0.6});
    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
  }

  private _setupScene() {

    this._scene = new Scene();
    this._scene.background = new Color(0xCCE6FF);
    this._camera = new PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    this._raycaster = new Raycaster();
    this._clock = new Clock();

    this._setupRenderer();

    this._grids = new Group();
    this._grids.visible = false;
    this._scene.add(this._grids);

    this._ambient = new AmbientLight(0xffffff, 0.2);
    this._scene.add(this._ambient);

    this._sun = new DirectionalLight(0xffffff, 0.7);
    this._sun.position.set(3, 3, 3);
    this._sun.castShadow = true;
    // this._sun.shadow.camera.right =  5;
    // this._sun.shadow.camera.left = -5;
    // this._sun.shadow.camera.top =  5;
    // this._sun.shadow.camera.bottom = -5;
    this._scene.add(this._sun);

    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = Math.degToRad(-30);
    this._camera.updateMatrixWorld(false);

    const plane = new PlaneGeometry(10000, 10000);

    this._workspacePlane = new Mesh(plane, new MeshBasicMaterial());
    this._workspacePlane.position.x = 0;
    this._workspacePlane.position.y = 0;
    this._workspacePlane.position.x = 0;
    this._workspacePlane.rotation.x = Math.DEG2RAD * -90;
    this._workspacePlane.updateMatrixWorld(false);
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
      size: 4,
      cellSize: .3,
      cellHeight: 0.5
    });
    grid.generate();

    const board = new vg.Board(grid);
    board.generateTilemap({
      extrudeSettings: {
        bevelEnabled: true,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
      }
    });

    board.group.children[0].children.forEach(c => {
      c.castShadow = false;
      c.receiveShadow = true;
    });

    board.group.position.x = data.position.x;
    board.group.position.y = data.position.y + 0.4;
    board.group.position.z = data.position.z;

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

  private _renderGame() {
    this._frames += 1;
    requestAnimationFrame(() => this._renderGame());

    const deltaTime = this._clock.getDelta();

    this._updateGame(deltaTime);

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame(deltaTime: number) {
  }

  private _fps(): number {
    const seconds = this._clock.getElapsedTime();
    return this._frames / seconds;
  }
};