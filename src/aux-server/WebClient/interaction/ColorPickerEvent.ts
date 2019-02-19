import { Vector2 } from "three";
import { File } from 'common/Files';

export interface ColorPickerEvent {
    /**
     * Position on the page that the color picker should be placed.
     */
    pagePos: Vector2;

    /**
     * The initial color value (in hex) of the color picker.
     */
    initialColor: string;

    /**
     * Callback function that will be invoked every time the color value is changed on the color picker.
     */
    colorUpdated: (hexColor: string) => void;

    /** 
     * Callback function that will be invoked when the color picker is closed. 
     * @argument inputScreenPos The page position of the input when the picker was closed.
     */
    pickerClosed?: (inputPagePos: Vector2) => void;
  }