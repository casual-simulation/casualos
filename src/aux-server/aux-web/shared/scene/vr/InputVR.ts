import VRController from 'three-vrcontroller-module';
import { VRController3D } from './VRController3D';
import { Game } from '../Game';
import { Ray, Color } from 'three';
import { find, remove } from 'lodash';
import { InputState } from '../Input';

export class InputVR {
    private _controller3Ds: VRController3D[];
    private _game: Game;

    get controllerCount(): number {
        if (this._controller3Ds) {
            return this._controller3Ds.length;
        } else {
            return 0;
        }
    }

    constructor(game: Game) {
        this._game = game;
        this._controller3Ds = [];

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

        this._controller3Ds.forEach(c => {
            c.update(this._game.getTime().frameCount);
        });
    }

    disconnectControllers() {
        console.log('[InputVR] disconnect controllers');
        let controllers = <any[]>VRController.controllers;
        controllers.forEach(controller => {
            VRController.onGamepadDisconnect(controller.gamepad);
        });
    }

    getController3D(controllerIndex: number): VRController3D {
        // Find matching controller 3d.
        return find(this._controller3Ds, (c: VRController3D) => {
            return c.controllerIndex === controllerIndex;
        });
    }

    private _handleVRControllerConnected(event: any) {
        console.log('[InputVR] VR Controller connected:', event);

        const controller = event.detail;
        controller.standingMatrix = (<any>(
            this._game.getRenderer().vr
        )).getStandingMatrix();
        controller.head = this._game.getMainCameraRig();

        const controller3D = new VRController3D(controller, this._game);
        this._controller3Ds.push(controller3D);

        // Controller 3d is parented to controller.
        controller.add(controller3D);

        // Add controller to the scene.
        this._game.getScene().add(controller);

        controller.addEventListener(
            'disconnected',
            this._handleVRControllerDisconnected
        );
    }

    private _handleVRControllerDisconnected(event: any) {
        console.log('[InputVR] VR controller disconnected:', event);

        const controller = event.controller;

        // Remove controller 3D.
        const removed = remove(this._controller3Ds, (m: VRController3D) => {
            return m.controller === controller;
        });
        if (removed) {
            removed.forEach((m: VRController3D) => {
                m.dispose();
            });
        }

        this._game.getScene().remove(controller);
    }
}
