import {
    Mesh,
    CylinderGeometry,
    BoxGeometry,
    Object3D,
    Ray,
    Color,
    MeshToonMaterial,
} from 'three';
import { InputState } from '../Input';
import { baseAuxMeshMaterial, disposeMesh } from '../SceneUtils';
import { InputVR } from './InputVR';
import { Game } from '../Game';

export const VRController_DefaultColor: Color = new Color('#db3236');
export const VRController_ClickColor: Color = new Color('#e5b94e');

export class VRController3D extends Object3D {
    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events
     */
    public debugLevel: number = 0;

    /**
     * List of buttons
     */
    private _buttonStates: InputState[] = [];

    /**
     * This is the VRController from VRController.js
     */
    private _controller: any;

    private _game: Game;
    private _arrowMesh: Mesh;
    private _arrowHandleMesh: Mesh;

    get controller() {
        return this._controller;
    }

    get controllerIndex(): number {
        return this.controller.gamepad.index;
    }

    get primaryButtonIndex(): number {
        return 1;
    }

    constructor(controller: any, game: Game) {
        super();

        this._controller = controller;
        this._game = game;
        console.log('controller:', controller);

        // Create the meshes.
        const controllerMaterial = baseAuxMeshMaterial();
        controllerMaterial.color.set(VRController_DefaultColor);
        controllerMaterial.flatShading = true;

        this._arrowMesh = new Mesh(
            new CylinderGeometry(0.005, 0.05, 0.1, 6),
            controllerMaterial
        );
        this._arrowHandleMesh = new Mesh(
            new BoxGeometry(0.03, 0.1, 0.03),
            controllerMaterial
        );
        this._arrowMesh.rotation.x = -Math.PI / 2;
        this._arrowHandleMesh.position.y = -0.05;
        this._arrowMesh.add(this._arrowHandleMesh);
        this.add(this._arrowMesh);

        // Create input states for all buttons found on the controller.
        let buttons = <any[]>this._controller.gamepad.buttons;
        for (let i = 0; i < buttons.length; i++) {
            this._buttonStates[i] = new InputState();
        }
    }

    /**
     * Returns true the frame that the primary button was pressed down.
     */
    getPrimaryButtonDown(): boolean {
        let buttonState = this._buttonStates[this.primaryButtonIndex];
        if (buttonState) {
            return buttonState.isDownOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns true every frame that the primary button is held down.
     */
    getPrimaryButtonHeld(): boolean {
        let buttonState = this._buttonStates[this.primaryButtonIndex];
        if (buttonState) {
            return buttonState.isHeldOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns true the frame that the primary button was released.
     */
    getPrimaryButtonUp(): boolean {
        let buttonState = this._buttonStates[this.primaryButtonIndex];
        if (buttonState) {
            return buttonState.isUpOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns true the frame that the button was pressed down.
     */
    getButtonDown(buttonIndex: number): boolean {
        let buttonState = this._buttonStates[buttonIndex];
        if (buttonState) {
            return buttonState.isDownOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Retruns true every frame the button is held down.
     */
    getButtonHeld(buttonIndex: number): boolean {
        let buttonState = this._buttonStates[buttonIndex];
        if (buttonState) {
            return buttonState.isHeldOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns true the frame that the button was released.
     */
    getButtonUp(buttonIndex: number): boolean {
        let buttonState = this._buttonStates[buttonIndex];
        if (buttonState) {
            return buttonState.isUpOnFrame(this._game.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns the pointer ray for the specified controller.
     */
    getPointerRay(): Ray {
        // let controllerMesh = this._getControllerMesh(controllerIndex);

        // if (controllerMesh) {
        //     let origin = new Vector3();
        //     let direction = new Vector3();
        //     let ray = new Ray(origin, direction);

        //     return ray;
        // }

        return null;
    }

    update(curFrame: number) {
        let buttons = <any[]>this._controller.gamepad.buttons;

        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            let inputState = this._buttonStates[i];

            if (button.pressed && !inputState.isHeldOnFrame(curFrame)) {
                // We have pressed this button down.
                inputState.setDownFrame(curFrame);

                if (this.debugLevel >= 1) {
                    console.log(
                        ' vr button ' +
                            i +
                            ' down. fireInputOnFrame: ' +
                            curFrame
                    );
                }
            } else if (!button.pressed && inputState.isHeldOnFrame(curFrame)) {
                // We have released this button.
                inputState.setUpFrame(curFrame);

                if (this.debugLevel >= 1) {
                    console.log(
                        ' vr button ' + i + ' up. fireInputOnFrame: ' + curFrame
                    );
                }
            }
        }
    }

    setColor(color: Color) {
        const arrowMat = <MeshToonMaterial>this._arrowMesh.material;
        arrowMat.color.set(color);

        const arrowHandleMat = <MeshToonMaterial>this._arrowHandleMesh.material;
        arrowHandleMat.color.set(color);
    }

    dispose() {
        disposeMesh(this._arrowMesh);
        disposeMesh(this._arrowHandleMesh);
    }
}
