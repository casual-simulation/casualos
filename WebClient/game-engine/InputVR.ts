import VRController from 'three-vrcontroller-module';
import GameView from '../GameView/GameView';
import { MeshStandardMaterial, Mesh, CylinderGeometry, BoxGeometry, Object3D } from 'three';
import { InputState } from './input';
import { find, remove } from 'lodash';

export class InputVR {
    
    private _controllerMeshes: ControllerMesh[];
    private _gameView: GameView;

    constructor(gameView: GameView) {

        this._gameView = gameView;
        this._controllerMeshes = [];

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
        controller.standingMatrix = (<any>this._gameView.renderer.vr).getStandingMatrix();
        controller.head = this._gameView.camera;
        
        let controllerMesh = new ControllerMesh(controller);
        this._controllerMeshes.push(controllerMesh);

        // Controller mesh is parented to controller.
        controller.add(controllerMesh);

        // Add controller to the scene.
        this._gameView.scene.add(controller);

        controller.addEventListener('disconnected', this._handleVRControllerDisconnected);

    }

    private _handleVRControllerDisconnected(event: any) {

        console.log("[InputVR] VR controller disconnected:");
        console.log(event);

        let controller = event.controller;

        // Remove controller mesh.
        let meshesRemoved = remove(this._controllerMeshes, (m: ControllerMesh) => { return m.controller === controller });
        if (meshesRemoved) {
            meshesRemoved.forEach((m: ControllerMesh) => {
                m.dispose();

            });
        }
        

        this._gameView.scene.remove(controller);

    }
}

class ControllerMesh extends Object3D
{
    /**
     * This is the VRController from VRController.js
     */
    private _controller: any;

    get controller() { return this._controller; }

    constructor(controller: any) {
        super();

        this._controller = controller;
        this.add(this._createMesh());
    }

    private _createMesh(): Mesh {

        let meshColor = 0xDB3236; //  Red.
        let controllerMaterial = new MeshStandardMaterial({
            color: meshColor
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

    dispose() {
        
    }
}