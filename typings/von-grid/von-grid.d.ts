import {
  ExtrudeGeometryOptions, 
  Group, 
  Vector3,
  Vector2,
  Intersection,
  Camera,
  Object3D,
  LineBasicMaterial,
} from 'three';

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
      generate(options?: GridConfig): void;
      size: number;
    }

    interface GridConfig {
      size?: number;
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
      constructor(options?: GridConfig);
    }

    class SqrGrid extends Grid {
      constructor(options?: GridConfig);
    }

    class Board {
      constructor(grid: Grid);
      generateTilemap(config?: TilemapConfig): void;
      generateOverlay(size: number, mat?: LineBasicMaterial): void;
      group: Group;
      grid: Grid;
    }

    class Scene {
      add(group: Group): void;
      focusOn(group: Group): void;
    }

    /**
      Translates mouse interactivity into 3D positions, so we can easily pick objects in the scene.

      Like everything else in ThreeJS, ray casting creates a ton of new objects each time it's used. This contributes to frequent garbage collections (causing frame hitches), so if you're limited to low-end hardware like mobile, it would be better to only update it when the user clicks, instead of every frame (so no hover effects, but on mobile those don't work anyway). You'll want to create a version that handles touch anyway.

      group - any Object3D (Scene, Group, Mesh, Sprite, etc) that the mouse will cast against
      camera - the camera to cast from
      [element] - optional element to attach mouse event to

      @author Corey Birnbaum https://github.com/vonWolfehaus/
    */
    class MouseCaster {
      down: boolean;
      rightDown: boolean;
      pickedObject: any;
      selectedObject: any;
      allHits: Intersection[];
      active: boolean;
      shift: boolean;
      ctrl: boolean;
      wheel: number;

      position: Vector3;
      screenPosition: Vector2;
      group: Object3D;

      constructor(group: Object3D, camera: Camera, element: HTMLElement);

      update(): void;
    }
  }
}