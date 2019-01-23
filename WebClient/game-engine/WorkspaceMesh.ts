import { Object3D } from "three";
import { HexGridMesh, HexGrid, HexMesh, keyToPos } from "./hex";
import { GridMesh } from "./grid/GridMesh";
import { Workspace } from "common/Files";
import { keys } from "lodash";
import { GridChecker } from "./grid/GridChecker";

/**
 * Defines a mesh that represents a workspace.
 */
export class WorkspaceMesh extends Object3D {

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

    constructor() {
        super();
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

        this.hexGrid = HexGridMesh.createFilledInHexGrid(this.workspace.size);

        const positionsKeys = keys(this.workspace.grid);
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = this.workspace.grid[key];
            
            const hex = this.hexGrid.addAt(position);
            hex.height = workspaceHex.height;
        });

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
        this.add(...this.squareGrids);
        return levels;
    }

    private _gridChanged(current: Workspace, previous: Workspace) {
        return !previous || current.size !== previous.size;
    }
}