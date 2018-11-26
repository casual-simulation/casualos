import {Group} from "three";

declare module 'von-grid' {
    namespace vg {
  
      class Grid {
  
      }

      interface HexGridConfig {
        size: number;
        cellSize?: number;
      }
  
      class HexGrid extends Grid {
          constructor(options?: HexGridConfig);
          generate(options?: HexGridConfig): void;
      }
  
      class Board {
          constructor(grid: Grid);
          generateTilemap(): void;
          group: Group;
      }
  
      class Scene {
          add(group: Group): void;
          focusOn(group: Group): void;
      }
    }
  }