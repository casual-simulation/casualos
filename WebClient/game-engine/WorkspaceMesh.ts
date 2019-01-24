import { Object3D, Vector3 } from "three";
import { HexGridMesh, HexGrid, HexMesh, keyToPos } from "./hex";
import { GridMesh } from "./grid/GridMesh";
import { Workspace, objDiff, DEFAULT_WORKSPACE_HEIGHT, DEFAULT_WORKSPACE_SCALE } from "common/Files";
import { keys, minBy } from "lodash";
import { GridChecker } from "./grid/GridChecker";
import { GameObject } from "./GameObject";

/**
 * Defines a mesh that represents a workspace.
 */
export class WorkspaceMesh extends GameObject {

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

    set gridsVisible(visible: boolean) {
        this.squareGrids.forEach(grid => {
            grid.visible = visible;
        });
    }

    constructor() {
        super();
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
     * @param workspace The new workspace data.
     * @param checker The grid checker.
     */
    async update(workspace: Workspace, checker?: GridChecker) {
        const prev = this.workspace;
        this.workspace = workspace;

        this.position.x = this.workspace.position.x;
        this.position.y = this.workspace.position.y;
        this.position.z = this.workspace.position.z;

        if (this._gridChanged(workspace, prev)) {
            this.updateHexGrid();
            if (checker) {
                await this.updateSquareGrids(checker);
            }
        }

        this.updateMatrixWorld(false);
    }

    /**
     * Updates the hex grid to match the workspace data.
     */
    updateHexGrid() {
        if (this.hexGrid) {
            this.remove(this.hexGrid);
        }
        
        this.hexGrid = HexGridMesh.createFilledInHexGrid(this.workspace.size, this.workspace.defaultHeight || DEFAULT_WORKSPACE_HEIGHT, this.workspace.scale || DEFAULT_WORKSPACE_SCALE);
        
        const positionsKeys = keys(this.workspace.grid);
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = this.workspace.grid[key];
            
            const hex = this.hexGrid.addAt(position);
            hex.height = workspaceHex.height;
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

        const levels = await checker.check(this.hexGrid);
        this.squareGrids = levels.map(l => new GridMesh(l));
        this.squareGrids.forEach(grid => grid.visible = false);
        this.add(...this.squareGrids);
        return levels;
    }

    private _gridChanged(current: Workspace, previous: Workspace) {
        return !previous || current.size !== previous.size || current.grid !== previous.grid;
    }
}