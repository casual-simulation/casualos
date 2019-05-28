import VRController from 'three-vrcontroller-module';
import { IGameView } from '../IGameView';
import {
    MeshStandardMaterial,
    Mesh,
    CylinderGeometry,
    BoxGeometry,
    Object3D,
    Ray,
    Vector3,
} from 'three';
import { InputState } from './Input';
import { find, remove } from 'lodash';

export class InputVR {
    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events
     */
    public debugLevel: number = 0;

    private _controllerMeshes: ControllerMesh[];
    private _gameView: IGameView;

    constructor(gameView: IGameView) {
        this._gameView = gameView;
        this._controllerMeshes = [];

        // VRController.verbosity = 1.0;

        this._handleVRControllerConnected = this._handleVRControllerConnected.bind(
            this
        );
        this._handleVRControllerDisconnected = this._handleVRControllerDisconnected.bind(
            this
        );

        // Lisen for vr controllers connecting.
        window.addEventListener(
            'vr controller connected',
            this._handleVRControllerConnected
        );
    }

    update() {
        VRController.update();

        this._controllerMeshes.forEach(mesh => {
            mesh.update(this._gameView.getTime().frameCount);
        });
    }

    disconnectControllers() {
        console.log('[InputVR] disconnect controllers');
        let controllers = <any[]>VRController.controllers;
        controllers.forEach(controller => {
            VRController.onGamepadDisconnect(controller.gamepad);
        });
    }

    /**
     * Returns true the frame that the button was pressed down.
     */
    getButtonDown(controllerIndex: number, buttonIndex: number): boolean {
        let buttonState = this._getButtonState(controllerIndex, buttonIndex);
        if (buttonState) {
            return buttonState.isDownOnFrame(
                this._gameView.getTime().frameCount
            );
        }

        return false;
    }

    /**
     * Retruns true every frame the button is held down.
     */
    getButtonHeld(controllerIndex: number, buttonIndex: number): boolean {
        let buttonState = this._getButtonState(controllerIndex, buttonIndex);
        if (buttonState) {
            return buttonState.isHeldOnFrame(
                this._gameView.getTime().frameCount
            );
        }

        return false;
    }

    /**
     * Returns true the frame that the button was released.
     */
    getButtonUp(controllerIndex: number, buttonIndex: number): boolean {
        let buttonState = this._getButtonState(controllerIndex, buttonIndex);
        if (buttonState) {
            return buttonState.isUpOnFrame(this._gameView.getTime().frameCount);
        }

        return false;
    }

    /**
     * Returns the pointer ray for the specified controller.
     */
    getPointerRay(controllerIndex: number): Ray {
        // let controllerMesh = this._getControllerMesh(controllerIndex);

        // if (controllerMesh) {
        //     let origin = new Vector3();
        //     let direction = new Vector3();
        //     let ray = new Ray(origin, direction);

        //     return ray;
        // }

        return null;
    }

    private _getControllerMesh(controllerIndex: number): ControllerMesh {
        // Find matching controller mesh.
        return find(this._controllerMeshes, (mesh: ControllerMesh) => {
            return mesh.controller.gamepad.index === controllerIndex;
        });
    }

    private _getButtonState(
        controllerIndex: number,
        buttonIndex: number
    ): InputState {
        // Find matching controller mesh.
        let controllerMesh = this._getControllerMesh(controllerIndex);

        if (controllerMesh) {
            // Find matching button state.
            let buttonState = controllerMesh.buttonStates[buttonIndex];
            if (buttonState) {
                return buttonState;
            }
        }

        return null;
    }

    private _handleVRControllerConnected(event: any) {
        console.log('[InputVR] VR Controller connected:');
        VRController.inspect();
        console.log(event);

        let controller = event.detail;
        controller.standingMatrix = (<any>(
            this._gameView.getRenderer().vr
        )).getStandingMatrix();
        controller.head = this._gameView.getMainCameraRig();

        let controllerMesh = new ControllerMesh(controller, this);
        this._controllerMeshes.push(controllerMesh);

        // Controller mesh is parented to controller.
        controller.add(controllerMesh);

        // Add controller to the scene.
        this._gameView.getScene().add(controller);

        controller.addEventListener(
            'disconnected',
            this._handleVRControllerDisconnected
        );
    }

    private _handleVRControllerDisconnected(event: any) {
        console.log('[InputVR] VR controller disconnected:');
        console.log(event);

        let controller = event.controller;

        // Remove controller mesh.
        let meshesRemoved = remove(
            this._controllerMeshes,
            (m: ControllerMesh) => {
                return m.controller === controller;
            }
        );
        if (meshesRemoved) {
            meshesRemoved.forEach((m: ControllerMesh) => {
                m.dispose();
            });
        }

        this._gameView.getScene().remove(controller);
    }
}

class ControllerMesh extends Object3D {
    /**
     * List of buttons
     */
    buttonStates: InputState[] = [];

    /**
     * This is the VRController from VRController.js
     */
    private _controller: any;

    private _inputVR: InputVR;

    get controller() {
        return this._controller;
    }

    constructor(controller: any, inputVR: InputVR) {
        super();

        this._controller = controller;
        this._inputVR = inputVR;
        this.add(this._createMesh());

        // Create input states for all buttons found on the controller.
        let buttons = <any[]>this._controller.gamepad.buttons;
        for (let i = 0; i < buttons.length; i++) {
            console.log('created input state for button ' + i);
            this.buttonStates[i] = new InputState();
        }
    }

    update(curFrame: number) {
        let buttons = <any[]>this._controller.gamepad.buttons;

        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            let inputState = this.buttonStates[i];

            if (button.pressed && !inputState.isHeldOnFrame(curFrame)) {
                // We have pressed this button down.
                inputState.setDownFrame(curFrame);

                if (this._inputVR.debugLevel >= 1) {
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

                if (this._inputVR.debugLevel >= 1) {
                    console.log(
                        ' vr button ' + i + ' up. fireInputOnFrame: ' + curFrame
                    );
                }
            }
        }
    }

    dispose() {}

    private _createMesh(): Mesh {
        let meshColor = 0xdb3236; //  Red.
        let controllerMaterial = new MeshStandardMaterial({
            color: meshColor,
        });
        let mesh = new Mesh(
            new CylinderGeometry(0.005, 0.05, 0.1, 6),
            controllerMaterial
        );
        let handleMesh = new Mesh(
            new BoxGeometry(0.03, 0.1, 0.03),
            controllerMaterial
        );
        controllerMaterial.flatShading = true;
        mesh.rotation.x = -Math.PI / 2;
        handleMesh.position.y = -0.05;
        mesh.add(handleMesh);

        return mesh;
    }
}
