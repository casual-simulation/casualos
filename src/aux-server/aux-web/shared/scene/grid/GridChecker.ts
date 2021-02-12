import {
    WebGLRenderer,
    OrthographicCamera,
    Scene,
    WebGLRenderTarget,
    Box3,
    Vector3,
    MathUtils as ThreeMath,
    Color,
    MeshBasicMaterial,
    Vector2,
    Object3D,
    Box3Helper,
} from 'three';
import { groupBy, keys } from 'lodash';
import { HexGridMesh, HexMesh } from '../hex';
import { GridLevel } from './GridLevel';
import { GridTile } from './GridTile';
import { calculateTilePoints, calculateGridTileLocalPositions } from './Grid';
import { WorkspaceMesh } from '../WorkspaceMesh';
import { createSphere, disposeMaterial } from '../SceneUtils';

/**
 * Defines a class that can check a HexGridMesh to see which square grid tiles
 * should be visible.
 *
 * It does this by doing an off-screen render of the worksurface at a resolution matching the
 * square grid tile size and bounds matching the hex grid. Upon completion it will check the resulting image
 * for tiles that have a hex under them or not and calculate whether the square grid should appear based on that.
 */
export class GridChecker {
    tileRatio = 0.2;
    private _supersampling = 2;
    private _renderer: WebGLRenderer;
    private _camera: OrthographicCamera;
    private _scene: Scene;
    private _grid: HexGridMesh;
    private _bounds: Box3;
    private _center: Vector3 = new Vector3();
    private _size: Vector3 = new Vector3();
    private _tileSize: number;
    private _hexes: HexMesh[];
    private _hexBounds: Box3;
    private _height: number;
    private _group: Object3D;
    private _parent: Object3D;
    private _worldPosition: Vector3;
    private _xImbalance: number;
    private _yImbalance: number;
    private _heightSpacing: number;
    private _debug: boolean = false;

    constructor(heightSpacing: number) {
        this._heightSpacing = 1 / heightSpacing;
        this._scene = new Scene();
        this._camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1);
        this._renderer = new WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            antialias: false,
        });
        this._debug = false;
        this._renderer.setClearColor(new Color(), 0);

        this._scene.add(this._camera);
    }

    setDebug(debug: boolean) {
        this._debug = debug;
    }

    async check(grid: HexGridMesh): Promise<GridCheckResults> {
        if (grid.hexes.length === 0) {
            return {
                levels: [],
                bounds: new Box3(),
            };
        }

        this._grid = grid;
        this._tileSize = this._grid.hexSize * this.tileRatio;

        this._updateBounds();
        this._updateCamera();
        this._updateRenderer();
        this._updateHexes();

        const groups = groupBy(this._grid.hexes, (h) =>
            Math.floor(h.height * this._heightSpacing)
        );
        const heights = keys(groups);
        const results = heights.map((h) =>
            this.checkLevel(groups[h], groups[h][0].height)
        );

        this._revertHexes();

        // Convert bounds to local space
        this._bounds.min.sub(this._worldPosition);
        this._bounds.max.sub(this._worldPosition);

        return {
            levels: results,
            bounds: this._bounds,
        };
    }

    checkLevel(hexes: HexMesh[], height: number): GridLevel {
        this._hexes = hexes;
        this._height = height;

        this._updateScene();

        this._render();

        const gl = this._renderer.context;
        const size = {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight,
        };
        const data = new Uint8Array(size.width * size.height * 4);
        gl.readPixels(
            0,
            0,
            size.width,
            size.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );

        const image = this._debug ? this._renderer.domElement.toDataURL() : '';

        this._teardownScene();

        let tiles: GridTile[] = [];
        const points = calculateTilePoints(this._tileSize);

        const actualWidth = size.width / this._supersampling;
        const actualHeight = size.height / this._supersampling;
        for (let x = 0; x < actualWidth; x++) {
            for (let y = 0; y < actualHeight; y++) {
                const centerPixel = this._pixelPos(x, y, size.width);
                const topLeftPixel = this._pixelPos(
                    x - 0.5,
                    y + 0.5,
                    size.width
                );
                const topRightPixel = this._pixelPos(
                    x + 0.5,
                    y + 0.5,
                    size.width
                );
                const bottomLeftPixel = this._pixelPos(
                    x - 0.5,
                    y - 0.5,
                    size.width
                );
                const bottomRightPixel = this._pixelPos(
                    x + 0.5,
                    y - 0.5,
                    size.width
                );

                const pixels = [
                    centerPixel,
                    topLeftPixel,
                    topRightPixel,
                    bottomLeftPixel,
                    bottomRightPixel,
                ];
                const alphas = pixels.map((p) => data[p + 3]);
                const matching = alphas.filter((a) => a);
                const valid = alphas.length - matching.length <= 1; // valid if at least 4 of the 5 hit

                // const r = data[pixel];
                // const g = data[pixel + 1];
                // const b = data[pixel + 2];
                const offsetX = x - actualWidth / 2;
                const offsetY = y - actualHeight / 2;
                const gridX = Math.ceil(offsetX);
                const gridY = Math.ceil(offsetY);
                const tilePoints = calculateGridTileLocalPositions(
                    gridX,
                    gridY,

                    // Divide by tileSize so that when height gets multiplied by tileSize it equals 1
                    // This makes the output Z match height exactly and not get scaled by tileSize.
                    height / this._tileSize,
                    this._tileSize,
                    points
                );
                tiles.push({
                    valid,
                    gridPosition: new Vector2(gridX, gridY),
                    localPosition: tilePoints.center,
                    // points: points,
                    localPoints: tilePoints.points,
                });
            }
        }

        return {
            tileHeight: height,
            _image: image,
            tiles: tiles,
            width: actualWidth,
            height: actualHeight,
            size: this._size,
            center: this._center,
        };
    }

    private _pixelPos(x: number, y: number, width: number) {
        const pixelX = x * this._supersampling;
        const pixelY = y * this._supersampling;
        const idx = pixelX + pixelY * width;
        const pixel = idx * 4;
        return pixel;
    }

    private _teardownScene() {
        this._scene.remove(this._group);
    }

    private _updateScene() {
        this._group = new Object3D();
        this._group.add(...this._hexes);
        this._scene.add(this._group);

        this._group.position.copy(this._worldPosition);

        this._hexBounds = new Box3().setFromObject(this._group);
        this._camera.position.set(
            this._worldPosition.x,
            this._hexBounds.max.y,
            this._worldPosition.z
        );
        this._camera.updateMatrixWorld(true);
    }

    private _updateHexes() {
        // update all the meshes with a unlit material.
        const mat = new MeshBasicMaterial({
            color: 0x000000,
        });
        this._grid.hexes.forEach((h) => {
            let a: any = h;
            a.__savedMat = h.material;
            h.material = mat;
        });
    }

    private _revertHexes() {
        // Re-add the hexes to the grid because Three.js Removed them from the other scene
        this._grid.add(...this._grid.hexes);

        // reset the meshes materials.
        this._grid.hexes.forEach((h) => {
            let a: any = h;
            const mat = h.material;
            h.material = a.__savedMat;

            disposeMaterial(mat);
        });
    }

    private _updateBounds() {
        this._worldPosition = new Vector3();
        this._bounds = new Box3().setFromObject(this._grid);
        this._grid.getWorldPosition(this._worldPosition);
    }

    private _updateCamera() {
        this._center = new Vector3();
        this._size = new Vector3();
        this._bounds.getCenter(this._center);
        this._bounds.getSize(this._size);

        const minX = this._bounds.min.x;
        const maxX = this._bounds.max.x;
        const minZ = this._bounds.min.z;
        const maxZ = this._bounds.max.z;

        const left = minX - this._worldPosition.x;
        const right = maxX - this._worldPosition.x;
        const top = maxZ - this._worldPosition.z;
        const bottom = minZ - this._worldPosition.z;
        this._xImbalance = Math.abs(Math.abs(left) - Math.abs(right));
        this._yImbalance = Math.abs(Math.abs(bottom) - Math.abs(top));

        this._size.add(new Vector3(this._xImbalance, 0, this._yImbalance));

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
        const tileWidth = Math.ceil(worldWidth / this._tileSize);
        const tileHeight = Math.ceil(worldHeight / this._tileSize);
        this._renderer.setSize(
            tileWidth * this._supersampling,
            tileHeight * this._supersampling
        );
    }

    private _render() {
        this._renderer.render(this._scene, this._camera);
    }

    public static createVisualization(
        results: GridCheckResults,
        options: GridCheckerVisualizationOptions = {}
    ) {
        let debugDots = new Object3D();
        const size = options.sphereSize || 0.05;
        const tileColor = options.tileCenterColor || 0x0000ff;
        const tilePointColor = options.tilePointColor || 0x00ff00;
        const invalidColor = options.invalidTileColor || 0xff0000;
        results.levels.forEach((level) => {
            level.tiles.forEach((tile) => {
                if (tile.valid || options.showInvalidPoints) {
                    const tileWorldPosition = new Vector3().copy(
                        tile.localPosition
                    );
                    if (options.workspace) {
                        tileWorldPosition.add(options.workspace.position);
                    }
                    debugDots.add(
                        createSphere(
                            tileWorldPosition,
                            tile.valid ? tileColor : invalidColor,
                            size
                        )
                    );
                    tile.localPoints.forEach((p) => {
                        const pointWorldPosition = new Vector3().copy(p);
                        if (options.workspace) {
                            pointWorldPosition.add(options.workspace.position);
                        }
                        debugDots.add(
                            createSphere(
                                pointWorldPosition,
                                tilePointColor,
                                size
                            )
                        );
                    });
                }
            });
        });
        if (
            options.showBoundingBoxes ||
            typeof options.showBoundingBoxes === 'undefined'
        ) {
            const bounds = new Box3().copy(results.bounds);
            if (options.workspace) {
                // convert to global space
                const workspaceGlobal = new Vector3();
                options.workspace.getWorldPosition(workspaceGlobal);
                bounds.min.add(workspaceGlobal);
                bounds.max.add(workspaceGlobal);
            }

            const boundsColor = options.boundsColor || 0xff00ff;
            const center = new Vector3();
            bounds.getCenter(center);
            const helper = new Box3Helper(null, new Color(boundsColor));
            helper.box = results.bounds;
            debugDots.add(helper);

            debugDots.add(createSphere(center, boundsColor, 0.1));
        }

        return debugDots;
    }
}

export interface GridCheckerVisualizationOptions {
    workspace?: WorkspaceMesh;
    showInvalidPoints?: boolean;
    showBoundingBoxes?: boolean;
    sphereSize?: number;

    tileCenterColor?: number;
    tilePointColor?: number;
    invalidTileColor?: number;
    boundsColor?: number;
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
     * The bounds of the workspace.
     */
    bounds: Box3;
}
