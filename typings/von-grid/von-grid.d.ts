import {Group, ExtrudeGeometryOptions} from "three";

declare module 'von-grid' {
    namespace vg {
  
      class Grid {
  
      }

      interface HexGridConfig {
        size: number;
        cellSize?: number;
        cellHeight?: number;
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
  
      class Board {
          constructor(grid: Grid);
          generateTilemap(config?: TilemapConfig): void;
          group: Group;
      }
  
      class Scene {
          add(group: Group): void;
          focusOn(group: Group): void;
      }
    }
  }