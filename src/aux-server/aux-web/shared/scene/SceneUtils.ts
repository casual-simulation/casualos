import { Vector3, MeshBasicMaterial, SphereBufferGeometry, Mesh, Object3D, Scene, Matrix4, Box2, Vector2, Box3, Layers } from 'three';
import { Text3D } from './Text3D';
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import { IGameView } from '../IGameView';

export function createSphere(position: Vector3, color: number, size: number = 0.1) {
    const sphereMaterial = new MeshBasicMaterial({
        color
    });
    const sphereGeometry = new SphereBufferGeometry(size);
    const sphere = new Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    return sphere;
}

export function createLabel(gameView: IGameView, parent: Object3D): Text3D {
    const label = new Text3D(gameView, parent, robotoFont, robotoTexturePath);
    return label;
}

/**
 * Set the parent of the object3d.
 * @param object3d the object to re-parent.
 * @param parent the object to parent to.
 * @param scene the scene that these objects exist in.
 */
export function setParent(object3d: Object3D, parent: Object3D, scene: Scene) {

    if (!object3d) return;
    if (!scene) throw new Error('utils.setParent needs a valid scene parameter.');

    // Detach
    if (object3d.parent && object3d.parent !== scene) {
        object3d.applyMatrix(object3d.parent.matrixWorld);
        object3d.parent.remove(object3d);
        scene.add(object3d);
    }
    
    // Attach
    if (parent) {
        object3d.applyMatrix(new Matrix4().getInverse(parent.matrixWorld));
        scene.remove(object3d);
        parent.add(object3d);
    }

    object3d.updateMatrixWorld(true);
}

/**
 * Convert the Box3 object to a box2 object. Basically discards the z components of the Box3's min and max.
 * @param box3 The Box3 to convert to a Box2.
 */
export function convertToBox2(box3: Box3): Box2 {
    return new Box2(
        new Vector2(box3.min.x, box3.min.y),
        new Vector2(box3.max.x, box3.max.y)
    );
}

/**
 * Set the layer number that the given object 3d is on (and optionally all of its children too).
 * @param obj The root object 3d to change the layer.
 * @param layer The layer to set the object 3d to.
 * @param children Should change all children of given object 3d as well?
 */
export function setLayer(obj: Object3D, layer: number, children?: boolean) {
    obj.layers.set(layer);
    if (children) {
        obj.traverse((child) => {
            child.layers.set(layer);
        });
    }
}

/**
 * Set the layer mask of the given object 3d (and optionally all of its children too).
 * @param obj The root object 3d to change the layer.
 * @param layerMask The layer mask to set the object 3d to.
 * @param children Should change all children of given object 3d as well?
 */
export function setLayerMask(obj: Object3D, layerMask: number, children?: boolean) {
    obj.layers.mask = layerMask;
    if (children) {
        obj.traverse((child) => {
            child.layers.mask = layerMask;
        });
    }
}

/**
 * Debug print out all 32 layers for this object and wether or not it belongs to them.
 * @param obj The object to print out layers for.
 */
export function debugLayersToString(obj: Object3D): string {
    if (!obj) return;

    let output: string = '\n';
    for (let i = 0; i < 32; i++) {
        let l = new Layers();
        l.set(i);
        output += '[' + i + ']  ' + obj.layers.test(l) + '\n';
    }

    return output;
}