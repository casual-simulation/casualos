import {Group} from "three";

declare module 'von-grid' {
    namespace vg {
  
      class Grid {
  
      }
  
      class HexGrid extends Grid {
          generate(options: {
              size: number
          }): void;
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