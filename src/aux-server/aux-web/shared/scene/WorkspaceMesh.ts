import { Object3D, Vector3, Color, Vector2 } from '@casual-simulation/three';
import {
    HexGridMesh,
    HexGrid,
    HexMesh,
    keyToPos,
    Axial,
    realPosToGridPos,
} from './hex';
import { GridMesh } from './grid/GridMesh';
import {
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_MINI_WORKSPACE_SCALE,
    AuxDomain,
    BotCalculationContext,
    calculateBotValue,
    getDimensionSize,
    getDimensionDefaultHeight,
    getDimensionScale,
    getBuilderDimensionGrid,
    getDimensionGridScale,
    isMinimized,
    isDimension,
    getDimensionColor,
    DEFAULT_WORKSPACE_COLOR,
    hasValue,
    getDimensionGridHeight,
    calculateGridScale,
    getDimensionVisualizeMode,
    Bot,
} from '@casual-simulation/aux-common';
import { minBy, isEqual } from 'lodash';
import { GridChecker, GridCheckResults } from './grid/GridChecker';
import { GameObject } from './GameObject';
import { AuxBot3D } from './AuxBot3D';
import { calculateGridTileLocalCenter } from './grid/Grid';
import { buildSRGBColor } from './SceneUtils';

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
    workspace: Bot;

    /**
     * The container for everything on the workspace.
     */
    container: Object3D;

    /**
     * The mini hex that is shown when the mesh is in mini mode.
     */
    miniHex: HexMesh;

    /**
     * The domain that this mesh should look at.
     */
    domain: AuxDomain;

    /**
     * The number of bots on this mesh.
     */
    botCount: number;

    /**
     * Sets the visibility of the grids on this workspace.
     */
    set gridsVisible(visible: boolean) {
        this.squareGrids.forEach((grid) => {
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
    constructor(domain: AuxDomain) {
        super();
        this.squareGrids = [];
        this.container = new Object3D();
        this.domain = domain;
        this.miniHex = new HexMesh(
            new Axial(0, 0),
            DEFAULT_MINI_WORKSPACE_SCALE,
            DEFAULT_WORKSPACE_HEIGHT
        );
        this.miniHex.visible = false;
        this.add(this.container);
        this.add(this.miniHex);
        this._debugInfo = {
            id: this.id,
            gridCheckResults: null,
        };
        this.botCount = 0;
    }

    /**
     * Sets whether this mesh should display debug information.
     * @param debug Whether the info should be shown.
     */
    showDebugInfo(debug: boolean) {
        this._debug = debug;
        // TODO: Fix sometime
        // this.update(undefined, true);
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
        const tiles = this.squareGrids
            .map((g) => g.closestTileToPoint(point))
            .filter((t) => !!t);
        const closest = minBy(tiles, (t) => t.distance);
        return closest;
    }

    /**
     * Updates the mesh with the new workspace data and optionally updates the square grid using the given
     * grid checker.
     * @param calc The bot calculation context.
     * @param workspace The new workspace data. If not provided the mesh will re-update using the existing data.
     * @param force Whether to force the workspace to update everything, even aspects that have not changed.
     */
    async update(
        calc: BotCalculationContext,
        workspace?: Bot,
        bots?: AuxBot3D[],
        force?: boolean
    ) {
        if (!workspace) {
            return;
        }
        const prev = this.workspace;
        this.workspace = workspace || prev;

        this.visible =
            isDimension(calc, this.workspace) &&
            getDimensionVisualizeMode(calc, this.workspace) === 'surface';
        this.container.visible = !isMinimized(calc, this.workspace);
        this.miniHex.visible = !this.container.visible;

        let gridUpdate: GridCheckResults = this._debugInfo.gridCheckResults;

        if (bots.length > this.botCount) {
            this.botCount = bots.length;
            force = true;
        }

        if (this._gridChanged(this.workspace, prev, calc) || force) {
            this._updateHexGrid(calc, bots);
            if (this._checker) {
                gridUpdate = await this._updateSquareGrids(this._checker, calc);

                if (this._debugMesh) {
                    this.remove(this._debugMesh);
                }
                if (this._debug) {
                    this._debugMesh = new Object3D();
                    this._debugMesh.add(
                        GridChecker.createVisualization(gridUpdate)
                    );
                    this.add(this._debugMesh);
                }
            }
        }

        // Hex color.
        const colorValue = getDimensionColor(calc, this.workspace);
        const color: Color = hasValue(colorValue)
            ? buildSRGBColor(colorValue)
            : buildSRGBColor(DEFAULT_WORKSPACE_COLOR);
        const hexes = this.hexGrid.hexes;
        hexes.forEach((h) => {
            h.color = color;
        });
        this.miniHex.color = color;

        this.updateMatrixWorld(false);

        if (this._debug) {
            this._debugInfo = {
                gridCheckResults: gridUpdate,
                id: this.id,
            };
        }
    }

    public frameUpdate() {}

    public dispose() {
        super.dispose();
    }

    /**
     * Updates the hex grid to match the workspace data.
     */
    private _updateHexGrid(calc: BotCalculationContext, bots: AuxBot3D[]) {
        if (this.hexGrid) {
            this.hexGrid.dispose();
            this.container.remove(this.hexGrid);
        }

        const size = getDimensionSize(calc, this.workspace);

        let centerHeight: number = getDimensionGridHeight(
            calc,
            this.workspace,
            '0:0'
        );
        const defaultHeight = getDimensionDefaultHeight(calc, this.workspace);
        const scale = getDimensionScale(calc, this.workspace);
        this.hexGrid = HexGridMesh.createFilledInHexGrid(
            size,
            centerHeight || DEFAULT_WORKSPACE_HEIGHT,
            scale || DEFAULT_WORKSPACE_SCALE
        );

        bots.forEach((bot) => {
            let localPosition = calculateGridTileLocalCenter(
                calculateBotValue(calc, bot.bot, bot.dimension + 'X'),
                calculateBotValue(calc, bot.bot, bot.dimension + 'Y'),
                calculateBotValue(calc, bot.bot, bot.dimension + 'Z'),
                calculateGridScale(calc, bot.dimensionGroup.bot)
            );

            let axial: Axial = realPosToGridPos(
                new Vector2(localPosition.x, localPosition.z),
                scale
            );
            const hexgrid = this.hexGrid.addAt(axial);
            hexgrid.height =
                centerHeight || defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
        });

        /*
        const grid = getBuilderContextGrid(calc, this.workspace);
        const positionsKeys = grid ? keys(grid) : [];
        positionsKeys.forEach(key => {
            const position = keyToPos(key);
            const workspaceHex = grid[key];

            if (grid['0:0'] != null) {
                centerHeight = grid['0:0'].height;
            }

            const hex = this.hexGrid.addAt(position);
            let nextHeight =
                centerHeight || defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            if (nextHeight < 0) {
                nextHeight = defaultHeight || DEFAULT_WORKSPACE_HEIGHT;
            }
            hex.height = nextHeight;
        });
        */

        this.colliders = [...this.hexGrid.hexes, this.miniHex];
        this.container.add(this.hexGrid);
    }

    /**
     * Updates the square grid to match the workspace data.
     * @param checker The grid checker to use.
     */
    private async _updateSquareGrids(
        checker: GridChecker,
        calc: BotCalculationContext
    ) {
        if (this.squareGrids && this.squareGrids.length > 0) {
            this.squareGrids.forEach((g) => g.dispose());
            this.container.remove(...this.squareGrids);
        }

        const gridScale = getDimensionGridScale(calc, this.workspace);
        checker.tileRatio = gridScale || DEFAULT_WORKSPACE_GRID_SCALE;
        const results = await checker.check(this.hexGrid);
        const levels = results.levels;
        this.squareGrids = levels.map((l) => new GridMesh(l));
        this.squareGrids.forEach((grid) => (grid.visible = false));
        if (this.squareGrids && this.squareGrids.length > 0) {
            this.container.add(...this.squareGrids);
        }
        return results;
    }

    private _gridChanged(
        current: Bot,
        previous: Bot,
        calc: BotCalculationContext
    ) {
        if (!previous) {
            return true;
        } else {
            const currentSize = getDimensionSize(calc, current);
            const previousSize = getDimensionSize(calc, previous);
            if (currentSize !== previousSize) {
                return true;
            } else {
                const currentGrid = getBuilderDimensionGrid(calc, current);
                const previousGrid = getBuilderDimensionGrid(calc, previous);

                return !isEqual(currentGrid, previousGrid);
            }
        }
    }
}

export interface WorkspaceMeshDebugInfo {
    id: number;
    gridCheckResults: GridCheckResults;
}
