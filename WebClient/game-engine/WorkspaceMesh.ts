import { Object3D, Vector3 } from "three";
import { HexGridMesh, HexGrid, HexMesh, keyToPos } from "./hex";
import { GridMesh } from "./grid/GridMesh";
import { Workspace, File, objDiff, DEFAULT_WORKSPACE_HEIGHT, DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_GRID_SCALE } from "common/Files";
import { keys, minBy } from "lodash";
import { GridChecker, GridCheckResults } from "./grid/GridChecker";
import { GameObject } from "./GameObject";

/**
 * Defines a mesh that represents a workspace.
 */
export class WorkspaceMesh extends GameObject {

    private _debugMesh: Object3D;
    private _debug: boolean;
    private _debugInfo: WorkspaceMeshDebugInfo;
    private _checker: GridChecker;

    /**
     * The hex grid for this workspace.
     */
    hexGrid: HexGridMesh;

    /**
     * The square grid for this workspace.
     */
    squareGrids: GridMesh[];

    /**
     * The workspace for this mesh.
     */
    workspace: Workspace;

    /**
     * Sets the visibility of the grids on this workspace.
     */
    set gridsVisible(visible: boolean) {
        this.squareGrids.forEach(grid => {
            grid.visible = visible;
        });
    }

    /**
     * Sets the GridChecker that this workspace should use to update its valid
     * grid positions.
     */
    set gridGhecker(val: GridChecker) {
        this._checker = val;
    }

    /**
     * Creates a new WorkspaceMesh.
     */
    constructor() {
        super();
        this._debugInfo = {
            id: this.id,
            gridChecker: null
        };
    }

    /**
     * Sets whether this mesh should display debug information.
     * @param debug Whether the info should be shown.
     */
    showDebugInfo(debug: boolean) {
        this._debug = debug;
        this.update(undefined, true);
    }

    /**
     * Gets the most recent debug info from the workspace.
     */
    getDebugInfo() {
        return this._debugInfo;
    }

    /**
     * Calculates the GridTile that is the closest to the given world point.
     * @param point The world point to test.
     */
    closestTileToPoint(point: Vector3) {
        const tiles = this.squareGrids.map(g => g.closestTileToPoint(point)).filter(t => !!t);
        const closest = minBy(tiles, t => t.distance);
        return closest;
    }

    /**
     * Updates the mesh with the new workspace data and optionally updates the square grid using the given
     * grid checker.
     * @param workspace The new workspace data. If not provided the mesh will re-update using the existing data.
     * @param force Whether to force the workspace to update everything, even aspects that have not changed.
     */
    async update(workspace?: File, force?: boolean) {
        if (workspace && workspace.type !== 'workspace') {
            return;
        }
        const prev = this.workspace;
        this.workspace = (<Workspace>workspace) || prev;

        this.visible = !!this.workspace.position;
        if (!this.workspace.position) {
            return;
        }
        this.position.x = this.workspace.position.x;
        this.position.y = this.workspace.position.y;
        this.position.z = this.workspace.position.z;

        let gridUpdate: GridCheckResults = this._debugInfo.gridChecker;

        if (this._gridChanged(this.workspace, prev) || force) {
            this.updateHexGrid();
            if (this._checker) {
                gridUpdate = await this.updateSquareGrids(this._checker);

                if (this._debugMesh) {
                    this.remove(this._debugMesh);
                }
                if (this._debug) {
                    this._debugMesh = new Object3D();
                    this._debugMesh.add(GridChecker.createVisualization(gridUpdate));
                    this.add(this._debugMesh);
                }
            }
        }

        this.updateMatrixWorld(false);

        this._debugInfo = {
            gridChecker: gridUpdate,
            id: this.id
        };
    }

    /**
     * Updates the hex grid to match the workspace data.
     */
    updateHexGrid() {
        if (this.hexGrid) {
            this.remove(this.hexGrid);
        }
        
        this.hexGrid = HexGridMesh.createFilledInHexGrid(
            this.workspace.size, 
            this.workspace.defaultHeight || DEFAULT_WORKSPACE_HEIGHT, 
            this.workspace.scale || DEFAULT_WORKSPACE_SCALE);
        
        const positionsKeys = this.workspace.grid ? keys(this.workspace.grid) : [];
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = this.workspace.grid[key];
            
            const hex = this.hexGrid.addAt(position);
            let nextHeight = workspaceHex.height || this.workspace.defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            if (nextHeight < 0) {
                nextHeight = this.workspace.defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            }
            hex.height = nextHeight;
        });
        
        this.colliders = [...this.hexGrid.hexes];
        this.add(this.hexGrid);
    }

    /**
     * Updates the square grid to match the workspace data.
     * @param checker The grid checker to use.
     */
    async updateSquareGrids(checker: GridChecker) {
        if (this.squareGrids) {
            this.remove(...this.squareGrids);
        }

        checker.tileRatio = this.workspace.gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
        const results = await checker.check(this.hexGrid);
        const levels = results.levels;
        this.squareGrids = levels.map(l => new GridMesh(l));
        this.squareGrids.forEach(grid => grid.visible = false);
        this.add(...this.squareGrids);
        return results;
    }

    private _gridChanged(current: Workspace, previous: Workspace) {
        return !previous || current.size !== previous.size || current.grid !== previous.grid;
    }
}

export interface WorkspaceMeshDebugInfo {
    id: number;
    gridChecker: GridCheckResults;
}