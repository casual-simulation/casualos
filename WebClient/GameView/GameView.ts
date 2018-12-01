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
} from 'three';
import Vue, {ComponentOptions} from 'vue';
import Component from 'vue-class-component';
import { 
  SubscriptionLike, 
  Observable, 
  fromEvent,
  combineLatest,
} from 'rxjs';
import { 
  filter,
  map,
} from 'rxjs/operators';

import {appManager} from '../AppManager';
import {fileManager} from '../FileManager';
import {FileCreatedEvent} from '../Core/Event';
import {File} from '../Core/File';
import {WorkspaceData} from '../Core/WorkspaceData';

import { vg } from "von-grid";

interface Ray {
  origin: Vector3;
  direction: Vector3;
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

function buttonDrag(active: Observable<boolean>): Observable<MouseEvent> {
  return combineLatest(
    active,
    mouseMove,
    (a, m) => ({a, m})
  ).pipe(
    filter(o => o.a),
    map(o => o.m)
  );
}

const leftDrag = buttonDrag(leftClickActive);
const rightDrag = buttonDrag(rightClickActive);

function screenPosition(gameView: HTMLElement) {
  return (e: MouseEvent) => {
    const globalPos = new Vector2(e.pageX, e.pageY);
    const gameViewRect = gameView.getBoundingClientRect();
    const gameViewPos = globalPos.sub(new Vector2(gameViewRect.left, gameViewRect.top));
    return new Vector2((gameViewPos.x / gameViewRect.width) * 2 - 1, -(gameViewPos.y / gameViewRect.height) * 2 + 1);
  };
}

interface RaycastTest {
  mouse: Vector2;
  intersects: Intersection[];
}

function raycast(raycaster: Raycaster, scene: Scene, camera: Camera) {
  return (pos: Vector2) => {
    raycaster.setFromCamera(pos, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    return {
      mouse: pos,
      intersects
    };
  };
}

function raycastSuccess() {
  return (test: RaycastTest) => test.intersects.length > 0;
}

function screenToRay(camera: Camera) {
  return (pos: Vector2) => {
    const v3d = new Vector3(pos.x, pos.y, 0.5);

    v3d.unproject(camera);

    v3d.sub(camera.position);
    v3d.normalize();
    
    return {
      origin: camera.position,
      direction: v3d
    };
  };
}

function pointOnRay(ray: Ray, distance: number): Vector3 {
  let pos = new Vector3(ray.direction.x, ray.direction.y, ray.direction.z);
  pos.multiplyScalar(distance);
  pos.add(ray.origin);

  return pos;
}

@Component
export default class GameView extends Vue {
  private _scene: Scene;
  private _camera: PerspectiveCamera;
  private _renderer: Renderer;
  private _raycaster: Raycaster;
  private _clock: Clock;

  private _sun: Light;
  private _ambient: Light;

  private _cube: Mesh;

  private _files: {
    [id: string]: {
      mesh: Mesh | Group,
      file: File
    }
  } = {};

  private _meshses: {
    [mesh: number]: string
  } = {};

  private _frames: number;

  private _sub: SubscriptionLike;

  async mounted() {
    this._files = {};
    this._meshses = {};
    this._scene = new Scene();
    this._scene.background = new Color(0xffffff);
    this._camera = new PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this._renderer = new WebGLRenderer({
      antialias: true
    });

    this._raycaster = new Raycaster();
        
    // TODO: Call each time the screen size changes
    const container: HTMLElement = <HTMLElement>this.$refs.container;
    this._renderer.setSize(window.innerWidth, window.innerHeight - container.getBoundingClientRect().top);
    container.style.height = this._renderer.domElement.style.height;

    this._clock = new Clock();

    const gameView: HTMLElement = <HTMLElement>this.$refs.gameView;
    gameView.appendChild(this._renderer.domElement);

    this._setupScene();

    this._clock.start();
    this._frames = 0;
    this._renderGame();

    fileManager.fileDiscovered.subscribe(file => {
      this._fileAdded(file);
    });
    fileManager.fileRemoved.subscribe(file => {
      this._fileRemoved(file);
    });

    const selectedObjects = isButton(mouseDown, 0)
      .pipe(
        map(screenPosition(gameView)),
        map(raycast(this._raycaster, this._scene, this._camera)),
        map(r => r.intersects.length > 0 ? r.intersects[0] : null)
      );
    
    const dragPositions = leftDrag.pipe(
      map(screenPosition(gameView)),
      map(screenToRay(this._camera)),
      map(ray => pointOnRay(ray, 2))
    );

    const dragOperations = combineLatest(
      selectedObjects,
      dragPositions,
      (obj, drag) => ({
        obj,
        drag
      })
    ).pipe(
      filter(op => op.obj !== null)
    );

    dragOperations.subscribe(op => {
      console.log('drag object', op);
      op.obj.object.position.x = op.drag.x;
      op.obj.object.position.y = op.drag.y;
      op.obj.object.position.z = op.drag.z;
    });

    // dragPositions.subscribe(op => {
    //   console.log('drag object');
    //   // op.obj.object.position.x = op.drag.x;
    //   // op.obj.object.position.y = op.drag.y;
    //   // op.obj.object.position.z = op.drag.z;
    // });

    // selectedObjects.subscribe(obj => {
    //   console.log('selected object', obj);
    // });

  }

  beforeDestroy() {
    if(this._sub) {
      this._sub.unsubscribe();
      this._sub = null;
    }
  }

  private _fileAdded(file: File) {
    console.log("File Added!");
    let mesh;
    if(file.type === 'file') {
      const cube = this._createCube(0.2);
      mesh = cube;
    } else {
      const board = this._createWorkSurface(file.data);
      mesh = board.group;
    }
    const obj = this._files[file.id] = {
      file: file,
      mesh: mesh
    };

    this._meshses[obj.mesh.id] = obj.file.id;

    this._scene.add(obj.mesh);
  }

  private _fileRemoved(file: File) {
    const obj = this._files[file.id];
    if (obj) {
      delete this._meshses[obj.mesh.id];
      delete this._files[file.id];
      this._scene.remove(obj.mesh);
    }
  }

  private _createCube(size: number): Mesh {
    
    var geometry = new BoxGeometry(size, size, size);
    var material = new MeshStandardMaterial(
        {color: 0x00ff00, metalness: 0, roughness: 0.6});
    return new Mesh(geometry, material);
  }

  private _setupScene() {
    this._ambient = new AmbientLight(0xffffff, 0.2);
    this._scene.add(this._ambient);

    this._sun = new DirectionalLight(0xffffff, 0.7);
    this._sun.position.set(1, 1, 1.5);
    this._sun.castShadow = true;
    this._scene.add(this._sun);

    this._camera.position.z = 5;
    this._camera.position.y = 3;
    this._camera.rotation.x = Math.degToRad(-30);
    this._camera.updateMatrixWorld(false);

    // this._cube = this._createCube(0.5);
    // this._cube.position.y = -1;
    // this._cube.rotation.y = 2;
    // this._cube.rotation.z = 0;
    // this._scene.add(this._cube);
  }

  private _createWorkSurface(data: WorkspaceData) {
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

    board.group.position.x = data.position.x;
    board.group.position.z = data.position.y;
    board.group.position.y = -1;

    return board;
  }

  private _renderGame() {
    this._frames += 1;
    requestAnimationFrame(() => this._renderGame());

    const deltaTime = this._clock.getDelta();

    this._updateGame(deltaTime);

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame(deltaTime: number) {
    // this._animateCube(deltaTime);
  }

  private _fps(): number {
    const seconds = this._clock.getElapsedTime();
    return this._frames / seconds;
  }
};