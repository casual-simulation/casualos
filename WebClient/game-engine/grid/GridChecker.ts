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
    Vector2,
    Object3D,
} from "three";
import {
    groupBy, keys
} from 'lodash';
import { HexGridMesh, HexMesh } from "../hex";
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
    private _hexes: HexMesh[];
    private _height: number;
    private _group: Object3D;

    constructor() {
        this._scene = new Scene();
        this._camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1);
        this._renderer = new WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            antialias: false
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
        this._updateHexes();

        const groups = groupBy(this._grid.hexes, h => Math.floor(h.height));
        const heights = keys(groups);
        const results = heights.map(h => this.checkLevel(groups[h], parseFloat(h)));
        
        this._revertHexes();

        return results;
    }

    checkLevel(hexes: HexMesh[], height: number): GridLevel {
        this._hexes = hexes;
        this._height = height;
        this._group = new Object3D();
        this._group.add(...this._hexes);

        this._updateScene();
        
        this._render();

        const gl = this._renderer.context;
        const size = {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight
        };
        const data = new Uint8Array(size.width * size.height * 4);
        gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, data);

        const image = this._renderer.domElement.toDataURL();

        this._teardownScene();

        let tiles: GridTile[] = [];

        for (let x = 0; x < size.width; x++) {
            for (let y = 0; y < size.height; y++) {
                const idx = x + (y * size.width);
                const pixel = idx * 4;
                // const r = data[pixel];
                // const g = data[pixel + 1];
                // const b = data[pixel + 2];
                const a = data[pixel + 3];
                if (a) {
                    const gridX = Math.ceil(x - (size.width / 2));
                    const gridY = Math.ceil(y - (size.height / 2));
                    tiles.push({
                        gridPosition: new Vector2(gridX, gridY),
                        // position: 
                    });
                }
            }
        }

        return {
            height: height,
            _image: image,
            tiles: tiles
        };
    }
    
    private _teardownScene() {
        this._scene.remove(this._group);
    }

    private _updateScene() {
        this._scene.add(this._group);

        const hexBounds = new Box3().setFromObject(this._group);
        this._camera.position.set(this._center.x, hexBounds.max.y, this._center.z);
    }
    
    private _updateHexes() {
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

    private _revertHexes() {
        // reset the meshes materials.
        this._grid.hexes.forEach(h => {
            let a: any = h;
            h.material = a.__savedMat;
        });
    }

    private _updateBounds() {
        this._bounds = new Box3().setFromObject(this._grid);
    }

    private _updateCamera() {
        this._bounds.getCenter(this._center);
        this._bounds.getSize(this._size);

        this._camera.rotation.set(ThreeMath.degToRad(-90), 0, 0);
        this._camera.left = -this._size.x / 2;
        this._camera.right = this._size.x / 2;
        this._camera.top = this._size.z / 2;
        this._camera.bottom = -this._size.z / 2;
        this._camera.near = 0;
        this._camera.far = 0.5;

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
        this._renderer.render(this._scene, this._camera);
        // return new Promise((resolve, reject) => {
        //     try {
        //         requestAnimationFrame(() => {
        //             try {
                        
        //                 resolve();
        //             } catch(ex) {
        //                 reject(ex);
        //             }
        //         });
        //     } catch(ex) {
        //         reject(ex);
        //     }
        // });
    }
}


/**
 * Defines an interface that contains results from the GridChecker.
 */
export interface GridCheckResults {
    /**
     * The levels that were found.
     */
    levels: GridLevel[];
    
    /**
     * The hex grid that was checked.
     */
    grid: HexGridMesh;
}

/**
 * Defines an interface that represents a single level of a square grid.
 */
export interface GridLevel {

    /**
     * The tiles.
     */
    tiles: GridTile[];

    /**
     * The height for this level.
     */
    height: number;

    /**
     * The data url for the image.
     */
    _image: string;
}

/**
 * Defines an interface that represents a single grid tile.
 */
export interface GridTile {

    /**
     * The HexGrid-relative position of the tile.
     */
    // position: Vector2;

    /**
     * The square grid position of the tile.
     */
    gridPosition: Vector2;
}