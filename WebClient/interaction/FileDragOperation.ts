import { Input } from '../game-engine/Input';
import { File3D } from '../game-engine/Interfaces';
import { IOperation } from './IOperation';
import GameView from '../GameView/GameView';

/**
 * File Drag Operation handles dragging of files for mouse and touch input.
 */
export class FileDragOperation implements IOperation {

    private _gameView: GameView;
    private _file: File3D;
    private _finished: boolean;


    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, file: File3D) {
        this._gameView = gameView;
        this._file = file;
    }

    public update(): void {
        if (this._finished) return;
    }

    public isFinished(): boolean { 
        return this._finished; 
    }

    public dispose(): void {
        console.log("[FileDragOperation] dispose");
    }
}