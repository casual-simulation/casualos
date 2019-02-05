import VRController from 'three-vrcontroller-module';
import GameView from '../GameView/GameView';
import { MeshStandardMaterial, Mesh, CylinderGeometry, BoxGeometry, Object3D } from 'three';

export class InputVR {

    private _gameView: GameView;

    constructor(gameView: GameView) {

        this._gameView = gameView;

        VRController.verbosity = 1.0;

        this._handleVRControllerConnected = this._handleVRControllerConnected.bind(this);
        this._handleVRControllerDisconnected = this._handleVRControllerDisconnected.bind(this);

        // Lisen for vr controllers connecting.
        window.addEventListener('vr controller connected', this._handleVRControllerConnected);

    }

    update() {

        VRController.update();

    }

    disconnectControllers() {
        console.log("[InputVR] disconnect controllers");
        let controllers = <any[]>VRController.controllers;
        controllers.forEach((controller) => {
            VRController.onGamepadDisconnect(controller.gamepad);
        });
    }

    private _handleVRControllerConnected(event: any) {

        console.log("[InputVR] VR Controller connected:");
        VRController.inspect();
        console.log(event);

        let controller = event.detail;

        // Controller is an Object3D. Lets add it to the scene.
        this._gameView.scene.add(controller);

        controller.standingMatrix = (<any>this._gameView.renderer.vr).getStandingMatrix();
        console.log('standing matrix:');
        console.log(controller.standingMatrix);
        controller.head = this._gameView.camera;
        console.log('head:');
        console.log(controller.head);

        //  Right now your controller has no visual.
        //  It’s just an empty THREE.Object3D.
        //  Let’s fix that!
        let meshColorOff = 0xDB3236; //  Red.
        let meshColorOn = 0xF4C20D; //  Yellow.
        let controllerMaterial = new MeshStandardMaterial({
            color: meshColorOff
        });
        let controllerMesh = new Mesh(
            new CylinderGeometry(0.005, 0.05, 0.1, 6),
            controllerMaterial
        );
        let handleMesh = new Mesh(
            new BoxGeometry(0.03, 0.1, 0.03),
            controllerMaterial
        );
        controllerMaterial.flatShading = true;
        controllerMesh.rotation.x = -Math.PI / 2;
        handleMesh.position.y = -0.05;
        controllerMesh.add(handleMesh);
        controller.userData.mesh = controllerMesh;//  So we can change the color later.
        controller.add(controllerMesh);

        controller.addEventListener('disconnected', this._handleVRControllerDisconnected);

    }

    private _handleVRControllerDisconnected(event: any) {

        console.log("[InputVR] VR controller disconnected:");
        console.log(event);
        
        let controller = event.controller;

        this._gameView.scene.remove(controller);

    }


}