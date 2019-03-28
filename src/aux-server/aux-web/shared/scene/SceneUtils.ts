import { Vector3, MeshBasicMaterial, SphereBufferGeometry, Mesh, Object3D, Scene, Matrix4, Box2, Vector2, Box3, Layers, BoxBufferGeometry, MeshStandardMaterial, BufferGeometry, BufferAttribute, Material, Geometry } from 'three';
import { Text3D } from './Text3D';
import { IGameView } from '../IGameView';
import { flatMap, sortBy } from 'lodash';
import { calculateNumericalTagValue, FileCalculationContext, File, getFilePosition, getFileIndex } from '@yeti-cgi/aux-common';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxFile3D } from './AuxFile3D';

export function createSphere(position: Vector3, color: number, size: number = 0.1) {
    const sphereMaterial = new MeshBasicMaterial({
        color
    });
    const sphereGeometry = new SphereBufferGeometry(size);
    const sphere = new Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(position);
    return sphere;
}

export function createCube(size: number): Mesh {
    let geometry = new BoxBufferGeometry(size, size, size);
    let material = new MeshStandardMaterial({
        color: 0x00ff00,
        metalness: .1,
        roughness: 0.6
    });
    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
}

export function createCubeStrokeGeometry(): BufferGeometry {
    const geo = new BufferGeometry();

    let verticies: number[][] = [
        [-0.5, -0.5, -0.5], // left  bottom back  - 0
        [ 0.5, -0.5, -0.5], // right bottom back  - 1
        [-0.5,  0.5, -0.5], // left  top    back  - 2
        [ 0.5,  0.5, -0.5], // right top    back  - 3
        [-0.5, -0.5,  0.5], // left  bottom front - 4
        [ 0.5, -0.5,  0.5], // right bottom front - 5
        [-0.5,  0.5,  0.5], // left  top    front - 6
        [ 0.5,  0.5,  0.5], // right top    front - 7
    ];

    const indicies = [
        0,1,
        0,2,
        0,4,

        4,5,
        4,6,

        5,7,
        5,1,

        1,3,

        2,3,
        2,6,

        3,7,

        6,7,
    ];
    const lines: number[] = flatMap(indicies, i => verticies[i]);
    const array = new Float32Array(lines);
    geo.addAttribute('position', new BufferAttribute(array, 3));

    return geo;
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
 * Find the scene object that the given object is parented to.
 * Will return null if no parent scene is found.
 * @param object3d The object to find the parent scene for.
 */
export function findParentScene(object3d: Object3D): Scene {
    if (!object3d) {
        return null;
    }

    if (object3d instanceof Scene) {
        return object3d;
    } else {
        return findParentScene(object3d.parent);
    }
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

/**
 * Calculates the scale.x, scale.y, and scale.z values from the given object.
 * @param context The calculation context.
 * @param obj The object.
 * @param multiplier The value that scale values should be multiplied by.
 * @param defaultScale The default value.
 * @param prefix The optional prefix for the tags. Defaults to `aux.`
 */
export function calculateScale(context: FileCalculationContext, obj: File, multiplier: number = 1, defaultScale: number = 1, prefix: string = 'aux.'): Vector3 {
    const scaleX = calculateNumericalTagValue(context, obj, `${prefix}scale.x`, defaultScale);
    const scaleY = calculateNumericalTagValue(context, obj, `${prefix}scale.y`, defaultScale);
    const scaleZ = calculateNumericalTagValue(context, obj, `${prefix}scale.z`, defaultScale);

    return new Vector3(scaleX * multiplier, scaleZ * multiplier, scaleY * multiplier);
}


/**
 * Determines whether the given color means transparent.
 * @param color The color to check.
 */
export function isTransparent(color: string): boolean {
    return color === 'transparent' || color === 'clear';
}

/**
 * Disposes the given material(s).
 * @param material The material(s) to dispose.
 */
export function disposeMaterial(material: Material | Material[]) {
    if (!material) return;
    if(Array.isArray(material)) {
        material.forEach(m => m.dispose());
    } else {
        material.dispose();
    }
}

/**
 * Releases any unmanaged resources used by the given mesh.
 * @param mesh The mesh to dispose.
 * @param disposeGeometry Whether to dispose the mesh's geometry. Default true.
 * @param disposeMat Whether to dispose the mesh's material(s). Default true.
 */
export function disposeMesh(mesh: { geometry: Geometry | BufferGeometry, material: Material | Material[] }, disposeGeometry: boolean = true, disposeMat: boolean = true) {
    if (!mesh) return;
    if (disposeGeometry) {
        mesh.geometry.dispose();
    }
    if (disposeMat) {
        disposeMaterial(mesh.material);
    }
}