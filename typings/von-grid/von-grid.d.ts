import {ExtrudeGeometryOptions, Group, Vector3} from 'three';

declare module 'von-grid' {
  namespace vg {

    interface Cell {
        /**
         * X Grid coordinate.
         */
        q :number;

        /**
         * Y grid coordinate.
         */
        r :number;

        /**
         * Z Grid coordinate.
         */
        s :number;

        /**
         * The 3D Height of the cell.
         */
        h :number;
    }

    class Grid {
      pixelToCell(pos: Vector3): Cell;
      cellToPixel(cell: Cell): Vector3;
    }

    interface HexGridConfig {
      size: number;
      cellSize?: number;
      cellHeight?: number;
    }

    interface SqrGridConfig {
      size: number;
      cellSize?: number;
    }

    interface TilemapConfig {
      tileScale?: number;
      cellSize?: number;
      material?: any;
      extrudeSettings?: ExtrudeGeometryOptions;
    }

    class HexGrid extends Grid {
      constructor(options?: HexGridConfig);
      generate(options?: HexGridConfig): void;
    }

    class SqrGrid extends Grid {
      constructor(options?: SqrGridConfig);
      generate(options?: SqrGridConfig): void;
    }

    class Board {
      constructor(grid: Grid);
      generateTilemap(config?: TilemapConfig): void;
      generateOverlay(size: number): void;
      group: Group;
      grid: Grid;
    }

    class Scene {
      add(group: Group): void;
      focusOn(group: Group): void;
    }
  }
}