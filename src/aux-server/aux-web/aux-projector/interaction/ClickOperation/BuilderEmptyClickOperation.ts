import { Input } from '../../../shared/scene/Input';
import { Vector2 } from 'three';
import { IOperation } from '../../../shared/interaction/IOperation';
import { DEFAULT_SCENE_BACKGROUND_COLOR } from '@yeti-cgi/aux-common';
import { appManager } from '../../../shared/AppManager';
import { ColorPickerEvent } from '../ColorPickerEvent';
import { EventBus } from '../../../shared/EventBus';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import GameView from '../../GameView/GameView';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class BuilderEmptyClickOperation implements IOperation {

    public static readonly DragThreshold: number = 0.02;
    public static CanOpenColorPicker = true;
    
    protected _interaction: BuilderInteractionManager;

    private _gameView: GameView;
    private _finished: boolean;
    private _startScreenPos: Vector2;

    constructor(gameView: GameView, interaction: BuilderInteractionManager) {
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

            if (distance < BuilderEmptyClickOperation.DragThreshold) {

                if (this._interaction.mode === 'worksurfaces') {

                    // When we release the empty click, make sure we are still over nothing.
                    const screenPos = this._gameView.input.getMouseScreenPos();
                    if (this._interaction.isEmptySpace(screenPos)) {

                        // Still not clicking on anything.
                        if (BuilderEmptyClickOperation.CanOpenColorPicker && !this._gameView.xrSession) {
                            this.sceneBackgroundColorPicker(this._gameView.input.getMousePagePos());
                        }

                    }
                } else if (this._interaction.mode === 'files') {
                    if (this._interaction.selectionMode === 'single') {
                        this._interaction.clearSelection();
                    }
                    appManager.fileManager.recent.selectedRecentFile = null;
                }
            }

            if (!BuilderEmptyClickOperation.CanOpenColorPicker) {
                // Turn color picker opening back on for the next empty click.
                BuilderEmptyClickOperation.CanOpenColorPicker = true;
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
                    'aux.scene.color': hexColor
                } 
            })
        };

        // This function is invoked when the color picker is closed.
        let pickerClosed = (inputPagePos: Vector2) => {
            let screenPos = Input.screenPosition(inputPagePos, this._gameView.gameView);
            if (this._interaction.isEmptySpace(screenPos)) {
                // temporarily disable color picker opening, until the next empty click.
                BuilderEmptyClickOperation.CanOpenColorPicker = false;
            }
        };

        let initialColor = globalsFile.tags['aux.scene.color'];
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