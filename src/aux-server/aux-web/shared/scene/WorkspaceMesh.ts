import { Object3D, Vector3, Color } from 'three';
import { HexGridMesh, HexGrid, HexMesh, keyToPos, Axial } from './hex';
import { GridMesh } from './grid/GridMesh';
import {
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_MINI_WORKSPACE_SCALE
} from '@yeti-cgi/aux-common/Files';
import { keys, minBy } from 'lodash';
import { GridChecker, GridCheckResults } from './grid/GridChecker';
import { GameObject } from './GameObject';
import { AuxFile } from '@yeti-cgi/aux-common/aux-format';
import { idEquals } from '@yeti-cgi/aux-common/causal-trees';

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
    workspace: AuxFile;

    /**
     * The container for everything on the workspace.
     */
    container: Object3D;

    /**
     * The mini hex that is shown when the mesh is in mini mode.
     */
    miniHex: HexMesh;

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
        this.container = new Object3D();
        this.miniHex = new HexMesh(
            new Axial(0, 0), 
            DEFAULT_MINI_WORKSPACE_SCALE, 
            DEFAULT_WORKSPACE_HEIGHT);
        this.miniHex.visible = false;
        this.add(this.container);
        this.add(this.miniHex);
        this._debugInfo = {
            id: this.id,
            gridCheckResults: null
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
    async update(workspace?: AuxFile, force?: boolean) {
        if (!workspace) {
            return;
        }
        const prev = this.workspace;
        this.workspace = (workspace) || prev;

        this.visible = !!this.workspace.tags['builder.context'];
        this.container.visible = !this.workspace.tags.minimized;
        this.miniHex.visible = !this.container.visible;
        this.position.x = this.workspace.tags['builder.context.x'] || 0;
        this.position.y = this.workspace.tags['builder.context.y'] || 0;
        this.position.z = this.workspace.tags['builder.context.z'] || 0;

        let gridUpdate: GridCheckResults = this._debugInfo.gridCheckResults;

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

        if (this.workspace.tags.color) {
            let color = new Color(this.workspace.tags.color);
            let hexes = this.hexGrid.hexes;
            hexes.forEach((h) => { h.color = color; });
            this.miniHex.color = color;
        }

        this.updateMatrixWorld(false);

        if (this._debug) {
            this._debugInfo = {
                gridCheckResults: gridUpdate,
                id: this.id
            };
        }
    }

    public frameUpdate() {
        super.frameUpdate();
    }

    public dispose() {
        super.dispose();
    }

    /**
     * Updates the hex grid to match the workspace data.
     */
    public updateHexGrid() {
        if (this.hexGrid) {
            this.container.remove(this.hexGrid);
        }
        
        this.hexGrid = HexGridMesh.createFilledInHexGrid(
            this.workspace.tags.size, 
            this.workspace.tags.defaultHeight || DEFAULT_WORKSPACE_HEIGHT, 
            this.workspace.tags.scale || DEFAULT_WORKSPACE_SCALE);
        
        const positionsKeys = this.workspace.tags.grid ? keys(this.workspace.tags.grid) : [];
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = this.workspace.tags.grid[key];
            
            const hex = this.hexGrid.addAt(position);
            let nextHeight = workspaceHex.height || this.workspace.tags.defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            if (nextHeight < 0) {
                nextHeight = this.workspace.tags.defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            }
            hex.height = nextHeight;
        });
        
        this.colliders = [...this.hexGrid.hexes, this.miniHex];
        this.container.add(this.hexGrid);
    }

    /**
     * Updates the square grid to match the workspace data.
     * @param checker The grid checker to use.
     */
    async updateSquareGrids(checker: GridChecker) {
        if (this.squareGrids) {
            this.container.remove(...this.squareGrids);
        }

        checker.tileRatio = this.workspace.tags.gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
        const results = await checker.check(this.hexGrid);
        const levels = results.levels;
        this.squareGrids = levels.map(l => new GridMesh(l));
        this.squareGrids.forEach(grid => grid.visible = false);
        this.container.add(...this.squareGrids);
        return results;
    }

    private _gridChanged(current: AuxFile, previous: AuxFile) {
        if (!previous || current.tags.size !== previous.tags.size) {
            return true;
        } else {
            const currentGrid = current.metadata.tags['grid'];
            const previousGrid = previous.metadata.tags['grid'];

            return !(currentGrid === previousGrid ||
                (currentGrid && previousGrid && idEquals(currentGrid.value.ref.atom.id, previousGrid.value.ref.atom.id)));
        }
    }
}

export interface WorkspaceMeshDebugInfo {
    id: number;
    gridCheckResults: GridCheckResults;
}