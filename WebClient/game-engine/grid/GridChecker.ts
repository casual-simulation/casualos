import { 
    WebGLRenderer, 
    OrthographicCamera, 
    Scene, 
    WebGLRenderTarget, 
    Box3, 
    Vector3,
    Math as ThreeMath,
    Color,
    MeshBasicMaterial,
} from "three";
import { HexGridMesh } from "../hex";
import TagEditor from "WebClient/TagEditor/TagEditor";

/**
 * Defines a class that can check a HexGridMesh to see which square grid tiles
 * should be visible.
 * 
 * It does this by doing an off-screen render of the worksurface at a resolution matching the 
 * square grid tile size and bounds matching the hex grid. Upon completion it will check the resulting image
 * for tiles that have a hex under them or not and calculate whether the square grid should appear based on that.
 */
export class GridChecker {

    private _tileRatio = 1;
    private _supersampling = 1;
    private _renderer: WebGLRenderer;
    private _camera: OrthographicCamera;
    private _scene: Scene;
    private _grid: HexGridMesh;
    private _bounds: Box3;
    private _center: Vector3 = new Vector3();
    private _size: Vector3 = new Vector3();
    private _tileSize: number;

    constructor() {
        this._scene = new Scene();
        this._camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1000);
        this._renderer = new WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true
        });
        this._renderer.setClearColor(new Color(), 0);

        document.body.appendChild(this._renderer.domElement);

        this._scene.add(this._camera);
    }

    async check(grid: HexGridMesh) {
        this._grid = grid;
        this._tileSize = this._grid.hexSize * this._tileRatio;
        this._updateBounds();
        this._updateCamera();
        this._updateRenderer();
        this._updateScene();
        
        await this._render();

        const data = this._renderer.domElement.toDataURL();

        this._teardownScene();

        return data;
    }
    
    private _teardownScene() {
        this._scene.remove(this._grid);

        // reset the meshes materials.
        this._grid.hexes.forEach(h => {
            let a: any = h;
            h.material = a.__savedMat;
        });
    }

    private _updateScene() {
        this._scene.add(this._grid);

        // update all the meshes with a unlit material.
        const mat = new MeshBasicMaterial({
            color: 0x000000
        });
        this._grid.hexes.forEach(h => {
            let a: any = h;
            a.__savedMat = h.material;
            h.material = mat;
        });
    }

    private _updateBounds() {
        this._bounds = new Box3().setFromObject(this._grid);
    }

    private _updateCamera() {
        this._bounds.getCenter(this._center);
        this._bounds.getSize(this._size);

        this._camera.position.set(this._center.x, this._center.y + this._size.y + 10, this._center.z);
        this._camera.rotation.set(ThreeMath.degToRad(-90), 0, 0);
        this._camera.left = -this._size.x / 2;
        this._camera.right = this._size.x / 2;
        this._camera.top = this._size.z / 2;
        this._camera.bottom = -this._size.z / 2;

        this._camera.updateMatrixWorld(false);
        this._camera.updateProjectionMatrix();
    }

    private _updateRenderer() {
        const worldWidth = this._size.x;
        const worldHeight = this._size.z;
        const tileWidth = worldWidth / this._tileSize;
        const tileHeight = worldHeight / this._tileSize;
        this._renderer.setSize(tileWidth * this._supersampling, tileHeight * this._supersampling);
    }

    private _render() {
        return new Promise((resolve, reject) => {
            try {
                requestAnimationFrame(() => {
                    try {
                        this._renderer.render(this._scene, this._camera);
                        resolve();
                    } catch(ex) {
                        reject(ex);
                    }
                });
            } catch(ex) {
                reject(ex);
            }
        });
    }

}