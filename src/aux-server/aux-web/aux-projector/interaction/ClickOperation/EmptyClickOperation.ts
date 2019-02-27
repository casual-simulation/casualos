import { Input, InputType, MouseButtonId } from '../../../shared/scene/Input';
import { Vector2, Vector3, Intersection, Raycaster } from 'three';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { DEFAULT_SCENE_BACKGROUND_COLOR } from '@yeti-cgi/aux-common';
import { appManager } from '../../../shared/AppManager';
import { ColorPickerEvent } from '../ColorPickerEvent';
import { EventBus } from '../../EventBus/EventBus';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class EmptyClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.02;
    public static CanOpenColorPicker = true;

    private _gameView: GameView;
    private _interaction: InteractionManager;
    private _finished: boolean;
    private _startScreenPos: Vector2;

    constructor(gameView: GameView, interaction: InteractionManager) {
        this._gameView = gameView;
        this._interaction = interaction;

        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.input.getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (!this._gameView.input.getMouseButtonHeld(0)) {
            
            const curScreenPos = this._gameView.input.getMouseScreenPos();
            const distance = curScreenPos.distanceTo(this._startScreenPos);

            if (distance < EmptyClickOperation.DragThreshold) {

                if (this._interaction.mode === 'worksurfaces') {

                    // When we release the empty click, make sure we are still over nothing.
                    const screenPos = this._gameView.input.getMouseScreenPos();
                    if (this._interaction.isEmptySpace(screenPos)) {

                        // Still not clicking on anything.
                        if (EmptyClickOperation.CanOpenColorPicker && !this._gameView.xrSession) {
                            this.sceneBackgroundColorPicker(this._gameView.input.getMousePagePos());
                        }

                    }
                }

            }

            if (!EmptyClickOperation.CanOpenColorPicker) {
                // Turn color picker opening back on for the next empty click.
                EmptyClickOperation.CanOpenColorPicker = true;
            }

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {

    }

    /**
     * Opens up the color picker and allows you to change the scene's background color.
     */
    public sceneBackgroundColorPicker(pagePos: Vector2) {
        
        let globalsFile = appManager.fileManager.globalsFile;

        // This function is invoked as the color picker changes the color value.
        let colorUpdated = (hexColor: string) => {
            appManager.fileManager.updateFile(globalsFile, { 
                tags: { 
                    _sceneBackgroundColor: hexColor
                } 
            })
        };

        // This function is invoked when the color picker is closed.
        let pickerClosed = (inputPagePos: Vector2) => {
            let screenPos = Input.screenPosition(inputPagePos, this._gameView.gameView);
            if (this._interaction.isEmptySpace(screenPos)) {
                // temporarily disable color picker opening, until the next empty click.
                EmptyClickOperation.CanOpenColorPicker = false;
            }
        };

        let initialColor = globalsFile.tags._sceneBackgroundColor;
        if (!initialColor) {
            initialColor = DEFAULT_SCENE_BACKGROUND_COLOR;
        }

        let colorPickerEvent: ColorPickerEvent = { 
            pagePos: pagePos, 
            initialColor: 
            initialColor, 
            colorUpdated: colorUpdated,
            pickerClosed: pickerClosed
         };

        EventBus.$emit('onColorPicker', colorPickerEvent);

    }
}