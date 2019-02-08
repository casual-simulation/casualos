import { Vector3, MeshBasicMaterial, SphereBufferGeometry, Mesh, Object3D } from "three";
import { Text3D } from "./Text3D";
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import GameView from "../GameView/GameView";

export function createSphere(position: Vector3, color: number, size: number = 0.1) {
    const sphereMaterial = new MeshBasicMaterial({
        color
    });
    const sphereGeometry = new SphereBufferGeometry(size);
    const sphere = new Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    return sphere;
}

export function createLabel(gameView: GameView, parent: Object3D): Text3D {
    const label = new Text3D(gameView, parent, robotoFont, robotoTexturePath);
    return label;
}