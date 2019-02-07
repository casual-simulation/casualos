import { Vector2 } from "three";
import { File } from 'common/Files';


export interface ColorPickerEvent {
    /**
     * Position on the page that the color picker should be placed.
     */
    pagePos: Vector2;
  
    /**
     * The file that the color picker is being used on.
     */
    file: File;
  }