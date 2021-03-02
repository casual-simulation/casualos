import {
    Vector3,
    SphereBufferGeometry,
    Mesh,
    Object3D,
    Scene,
    Matrix4,
    Box2,
    Vector2,
    Box3,
    Layers,
    BoxBufferGeometry,
    BufferGeometry,
    BufferAttribute,
    Material,
    ConeGeometry,
    DoubleSide,
    AmbientLight,
    DirectionalLight,
    MathUtils as ThreeMath,
    Euler,
    SpriteMaterial,
    Sprite,
    PlaneBufferGeometry,
    Color,
    MeshStandardMaterial,
    Ray,
    Quaternion,
    MeshBasicMaterial,
    Camera,
    Sphere,
    PerspectiveCamera,
    Group,
    LineSegments,
    LineBasicMaterial,
    MeshToonMaterial,
} from '@casual-simulation/three';
import { flatMap } from 'lodash';
import {
    BotCalculationContext,
    Bot,
    BotLabelAnchor,
    getBotScale,
} from '@casual-simulation/aux-common';
import { getOptionalValue } from '../SharedUtils';

/**
 * Create copy of material that most meshes in Aux Builder/Player use.
 */
export function baseAuxMeshMaterial() {
    return new MeshToonMaterial({
        color: 0x00ff00,
        shininess: 2,
    });
}

/**
 * Create copy of ambient light that is common to all aux scenes.
 */
export function baseAuxAmbientLight() {
    return new AmbientLight(0x222222);
}

/**
 * Create copy of directional light that is common to all aux scenes.
 */
export function baseAuxDirectionalLight() {
    let dirLight = new DirectionalLight(0xffffff, 1);
    dirLight.position.set(0.25, 3.0, 2.4);
    dirLight.updateMatrixWorld(true);
    // let helper = new DirectionalLightHelper(dirLight);
    // dirLight.add(helper);
    return dirLight;
}

/**
 * Creates a new sphere mesh.
 * @param position The position of the sphere.
 * @param color The color of the sphere in linear space.
 * @param size The size of the sphere in meters.
 */
export function createSphere(
    position: Vector3,
    color: number,
    size: number = 0.1
) {
    const geometry = new SphereBufferGeometry(size, 16, 14);
    let material = baseAuxMeshMaterial();
    material.color = new Color(color);

    const sphere = new Mesh(geometry, material.clone());
    sphere.position.copy(position);
    return sphere;
}

export function createSprite(): Mesh {
    let material = new MeshBasicMaterial({
        transparent: true,
        side: DoubleSide,
    });

    const geometry = new PlaneBufferGeometry(1, 1, 16, 16);
    let sprite = new Mesh(geometry, material.clone());
    return sprite;
}

/**
 * Creates a "user cone" mesh.
 * @param radius The radius of the cone.
 * @param height
 * @param color The color of the cone in linear space.
 */
export function createUserCone(
    radius?: number,
    height?: number,
    color?: string | number
): Mesh {
    radius = getOptionalValue(radius, 0.5);
    height = getOptionalValue(height, 0.7);
    const geometry = new ConeGeometry(radius, height, 4, 1, true);
    let material = baseAuxMeshMaterial();
    material.color.set(new Color(color || 0x00d000));
    material.side = DoubleSide;
    material.flatShading = true;
    material.transparent = true;
    material.opacity = 0.4;
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
}

const DEFAULT_CUBE_GEOMETRY = new BoxBufferGeometry(1, 1, 1);

/**
 * Creates a new cube mesh.
 * @param size The size of the cube in meters.
 */
export function createCube(size: number): Mesh {
    const geometry =
        size === 1
            ? DEFAULT_CUBE_GEOMETRY
            : new BoxBufferGeometry(size, size, size);
    let material = baseAuxMeshMaterial();

    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
}

/**
 * Creates a new plane mesh.
 * @param size The size of the mesh in meters.
 */
export function createPlane(size: number): Mesh {
    const geometry = new PlaneBufferGeometry(size, size);
    let material = baseAuxMeshMaterial();

    const plane = new Mesh(geometry, material);
    plane.castShadow = false;
    plane.receiveShadow = false;
    return plane;
}

export function createCubeStrokeGeometry(): BufferGeometry {
    const geo = new BufferGeometry();

    let verticies: number[][] = [
        [-0.5, -0.5, -0.5], // left  bottom back  - 0
        [0.5, -0.5, -0.5], // right bottom back  - 1
        [-0.5, 0.5, -0.5], // left  top    back  - 2
        [0.5, 0.5, -0.5], // right top    back  - 3
        [-0.5, -0.5, 0.5], // left  bottom front - 4
        [0.5, -0.5, 0.5], // right bottom front - 5
        [-0.5, 0.5, 0.5], // left  top    front - 6
        [0.5, 0.5, 0.5], // right top    front - 7
    ];

    const indicies = [
        0,
        1,
        0,
        2,
        0,
        4,

        4,
        5,
        4,
        6,

        5,
        7,
        5,
        1,

        1,
        3,

        2,
        3,
        2,
        6,

        3,
        7,

        6,
        7,
    ];
    const lines: number[] = flatMap(indicies, (i) => verticies[i]);
    const array = new Float32Array(lines);
    geo.setAttribute('position', new BufferAttribute(array, 3));

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
    if (!scene)
        throw new Error('utils.setParent needs a valid scene parameter.');

    // Detach
    if (object3d.parent && object3d.parent !== scene) {
        object3d.applyMatrix4(object3d.parent.matrixWorld);
        object3d.parent.remove(object3d);
        scene.add(object3d);
    }

    // Attach
    if (parent) {
        object3d.applyMatrix4(new Matrix4().copy(parent.matrixWorld).invert());
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
export function setLayerMask(
    obj: Object3D,
    layerMask: number,
    children?: boolean
) {
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

export function isObjectVisible(obj: Object3D) {
    if (!obj) {
        return false;
    }
    while (obj) {
        if (!obj.visible) {
            return false;
        }
        obj = obj.parent;
    }
    return true;
}

/**
 * Calculates the scale.x, scale.y, and scale.z values from the given object.
 * @param context The calculation context.
 * @param obj The object.
 * @param multiplier The value that scale values should be multiplied by.
 * @param defaultScale The default value.
 * @param prefix The optional prefix for the tags. Defaults to `aux.`
 */
export function calculateScale(
    context: BotCalculationContext,
    obj: Bot,
    multiplier: number = 1,
    defaultScale: number = 1,
    prefix?: string
): Vector3 {
    const scale = getBotScale(context, obj, defaultScale, prefix);
    return new Vector3(
        scale.x * multiplier,
        scale.z * multiplier,
        scale.y * multiplier
    );
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
    if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
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
export function disposeMesh(
    mesh: {
        geometry: BufferGeometry;
        material: Material | Material[];
    },
    disposeGeometry: boolean = true,
    disposeMat: boolean = true
) {
    if (!mesh) return;
    if (disposeGeometry) {
        mesh.geometry.dispose();
    }
    if (disposeMat) {
        disposeMaterial(mesh.material);
    }
}

export function disposeObject3D(
    object3d: Object3D,
    disposeGeometry: boolean = true,
    disposeMaterial: boolean = true
) {
    if (!object3d) return;

    if (disposeGeometry) {
        let geometry = (<any>object3d).geometry;
        if (geometry) {
            geometry.dispose();
        }
    }

    if (disposeMaterial) {
        let material = (<any>object3d).material;
        if (material) {
            if (Array.isArray(material)) {
                for (let i = 0; i < material.length; i++) {
                    material[i].dispose();
                }
            } else {
                material.dispose();
            }
        }
    }
}

/**
 * Disposes of the entire group.
 * @param group The group to dispose.
 */
export function disposeGroup(group: Group) {
    if (!group) {
        return;
    }
    group.traverse((obj) => disposeObject3D(obj));
}

/**
 * Calculates the position and rotation that the given object should be placed at for the given anchor and position.
 * @param anchorBounds The bounds being anchored to. Should be in local space relative to the given obj.
 * @param anchorType The anchor type that will be calculated.
 * @param obj The object to anchor.
 * @param objBoundingBox The bounding box of the object to anchor. Should be in local space relative to the given obj.
 * @param defaultScale The default scale of the object.
 * @param extraSpace The extra spacing to use as padding away from the anchor position.
 */
export function calculateAnchorPosition(
    anchorBounds: Box3,
    anchorType: BotLabelAnchor,
    obj: Object3D,
    objBoundingBox: Box3,
    defaultScale: number,
    extraSpace: number
): [Vector3, Euler] {
    const myMax = objBoundingBox.max.clone();
    const myMin = objBoundingBox.min.clone();

    // // Position the mesh some distance above the given object's bounding box.
    const targetSize = new Vector3();
    anchorBounds.getSize(targetSize);
    const targetCenter = new Vector3();
    anchorBounds.getCenter(targetCenter);

    if (anchorType === 'floating') {
        const paddingScalar = obj.scale.x / defaultScale;
        const bottomCenter = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(bottomCenter);
        const pos = new Vector3(
            targetCenter.x,
            targetCenter.y + targetSize.y * 0.5 + extraSpace * paddingScalar,
            targetCenter.z
        );
        pos.add(objOffset);

        return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
    } else if (anchorType === 'top') {
        const center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(center);
        const pos = new Vector3(
            targetCenter.x,
            targetCenter.y + targetSize.y * 0.5 + extraSpace,
            targetCenter.z
        );
        pos.add(objOffset);

        return [pos, new Euler(ThreeMath.degToRad(0), 0, 0)];
    } else if (anchorType === 'front') {
        const center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(center);
        const pos = new Vector3(
            targetCenter.x,
            targetCenter.y,
            targetCenter.z + targetSize.z * 0.5 + extraSpace
        );
        pos.add(objOffset);

        return [pos, new Euler(ThreeMath.degToRad(90), 0, 0)];
    } else if (anchorType === 'back') {
        const center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(center);
        const pos = new Vector3(
            targetCenter.x,
            targetCenter.y,
            targetCenter.z - targetSize.z * 0.5 - extraSpace
        );
        pos.add(objOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(180), 0),
        ];
    } else if (anchorType === 'right') {
        const center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(center);
        const pos = new Vector3(
            targetCenter.x - targetSize.x * 0.5 - extraSpace,
            targetCenter.y,
            targetCenter.z
        );
        pos.add(objOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(90), 0),
        ];
    } else if (anchorType === 'left') {
        const center = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            (myMax.y - myMin.y) / 2 + myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        const objOffset = obj.position.clone().sub(center);
        const pos = new Vector3(
            targetCenter.x + targetSize.x * 0.5 + extraSpace,
            targetCenter.y,
            targetCenter.z
        );
        pos.add(objOffset);

        return [
            pos,
            new Euler(ThreeMath.degToRad(90), ThreeMath.degToRad(-90), 0),
        ];
    }

    return [targetCenter, new Euler()];
}

/**
 * Creates a Color object to represent the given sRGB color.
 * Because the renderer automatically converts output colors from linear to sRGB,
 * any colors that are provided in sRGB format need to be converted back to linear.
 * This function converts the given color from sRGB to linear and returns the result.
 * @param args The arguments for the color constructor.
 */
export function buildSRGBColor(...args: (string | number)[]): Color {
    const c = new Color(...args);
    c.convertSRGBToLinear();
    return c;
}

/**
 * Changes the mesh's material to the given color.
 * @param mesh The mesh.
 * @param color The color in sRGB space.
 */
export function setColor(mesh: Mesh | Sprite | LineSegments, color: string) {
    if (!mesh) {
        return;
    }
    const shapeMat = <
        MeshStandardMaterial | MeshToonMaterial | LineBasicMaterial
    >mesh.material;
    if (color) {
        shapeMat.visible = !isTransparent(color);
        if (shapeMat.visible) {
            shapeMat.color = buildSRGBColor(color);
        }
    } else {
        shapeMat.visible = true;
        shapeMat.color = new Color(0xffffff);
    }
}

/**
 * Creates a ray for the given direction from the given object's perspective in world space.
 * @param direction The direction.
 * @param obj The object.
 */
export function objectWorldDirectionRay(
    direction: Vector3,
    obj: Object3D
): Ray {
    const worldRotation = new Quaternion();
    worldRotation.setFromRotationMatrix(obj.matrixWorld);
    // obj.getWorldQuaternion(worldRotation);
    const forward = direction.applyQuaternion(worldRotation);
    const worldPosition = new Vector3();
    worldPosition.setFromMatrixPosition(obj.matrixWorld);
    // obj.getWorldPosition(worldPosition);
    return new Ray(worldPosition, forward);
}

/**
 * Creates a ray for the forward facing direction for the given camera.
 * @param camera The camera.
 */
export function cameraForwardRay(camera: Camera): Ray {
    return objectWorldDirectionRay(new Vector3(0, 0, -1), camera);
}

/**
 * Creates a ray for the given direction from the given object's perspective.
 * @param direction The direction.
 * @param obj The object.
 */
export function objectDirectionRay(direction: Vector3, obj: Object3D): Ray {
    const forward = direction.applyQuaternion(obj.quaternion);
    return new Ray(obj.position, forward);
}

/**
 * Creates a ray for the given object's forward direction.
 * @param obj The object.
 */
export function objectForwardRay(obj: Object3D): Ray {
    return objectDirectionRay(new Vector3(0, 0, -1), obj);
}

export function objectWorldForwardRay(obj: Object3D): Ray {
    return objectWorldDirectionRay(new Vector3(0, 0, -1), obj);
}

// The width and height of clip space
// See https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
const clipWidth = 2;
const clipHeight = 2;
const clipArea = clipWidth * clipHeight;
const clipAreaRatio = 1 / clipArea;
const clipBox = new Box3().set(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

/**
 * Calculates the apparent size of the given sphere viewed by the camera.
 * If the sphere is off screen, 0 is returned. Otherwise it is the percentage that the sphere takes on the screen.
 *
 * @param camera The camera to use.
 * @param boundingSphere The sphere to use. Should be in world space.
 */
export function percentOfScreen(
    camera: Camera,
    boundingSphere: Sphere
): number {
    const sphere = boundingSphere.clone();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    sphere.applyMatrix4(camera.matrixWorldInverse);

    let radius: number = null;
    if (camera instanceof PerspectiveCamera) {
        // Calculate the final radius of the sphere
        // by projecting both the center and an edge of the sphere
        // and measuring the distance between them.
        // We need to do this for perspective cameras
        // because the three.js Sphere class doesn't
        // scale the radius properly.
        const center = sphere.center.clone();
        const edge = center.clone().add(new Vector3(sphere.radius, 0, 0));
        center.applyMatrix4(camera.projectionMatrix);
        edge.applyMatrix4(camera.projectionMatrix);
        const finalRadius = center.distanceTo(edge);
        radius = finalRadius;
    }

    sphere.applyMatrix4(camera.projectionMatrix);

    if (radius === null) {
        radius = sphere.radius;
    }

    if (sphere.intersectsBox(clipBox)) {
        // Spheres are uniform so we can ignore the Z axis
        // and only consider the area of a circle when comparing to
        // the screen area.
        const circleArea = Math.PI * radius * radius;
        return circleArea * clipAreaRatio;
    } else {
        return 0;
    }
}

/**
 * Safely sets the parent of the given object to the given parent by ensuring that there are no infinite cycles.
 * Returns whether the object was able to be parented.
 * @param obj The object whose parent should be set.
 * @param parent The parent.
 */
export function safeSetParent(obj: Object3D, parent: Object3D): boolean {
    if (obj.parent === parent) {
        return true;
    }
    let grandparent = parent;
    while (grandparent) {
        if (grandparent === obj) {
            return false;
        }
        grandparent = grandparent.parent;
    }

    if (obj.parent) {
        obj.parent.remove(obj);
    }
    parent.add(obj);
    return true;
}
