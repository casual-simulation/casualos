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
    LineSegments as ThreeLineSegments,
    LineBasicMaterial,
    MeshToonMaterial,
    Intersection,
    CircleBufferGeometry,
    Float32BufferAttribute,
    MeshNormalMaterial,
    Texture,
    Cache,
} from '@casual-simulation/three';
import { flatMap } from 'lodash';
import {
    BotCalculationContext,
    Bot,
    BotLabelAnchor,
    getBotScale,
    getBotTransformer,
    CameraType,
    clamp,
} from '@casual-simulation/aux-common';
import { getOptionalValue } from '../SharedUtils';
import { Simulation } from '@casual-simulation/aux-vm';

/**
 * Gets the direction of the up vector for 3D portals.
 */
export const WORLD_UP = new Vector3(0, 0, 1);

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
    dirLight.position.set(0.25, -2.4, 3.0);
    dirLight.updateMatrixWorld(true);
    // let helper = new DirectionalLightHelper(dirLight);
    // dirLight.add(helper);
    return dirLight;
}

/**
 * Creates a new sphere mesh.
 * @param position The position of the sphere.
 * @param color The color of the sphere in linear space.
 * @param size The radius of the sphere in meters.
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

/**
 * Creates a new sprite mesh.
 * @param uvAspectRatio The aspect ratio that the cube's UV coordinates should use.
 */
export function createSprite(uvAspectRatio: number = 1): Mesh {
    let material = new MeshBasicMaterial({
        transparent: true,
        side: DoubleSide,
    });

    const geometry = new PlaneBufferGeometry(1, 1, 16, 16);
    adjustUVs(geometry, uvAspectRatio);
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
    // material.flatShading = true;
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
 * @param uvAspectRatio The aspect ratio that the cube's UV coordinates should use.
 */
export function createCube(size: number, uvAspectRatio: number = 1): Mesh {
    const geometry =
        size === 1 && uvAspectRatio === 1
            ? DEFAULT_CUBE_GEOMETRY
            : new BoxBufferGeometry(size, size, size);

    adjustUVs(geometry, uvAspectRatio);
    let material = baseAuxMeshMaterial();

    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
}

/**
 * Creates a new circle mesh.
 * @param size The radius of the circle in meters.
 * @param uvAspectRatio The aspect ratio that the circle's UV coordinates should use.
 */
export function createCircle(size: number, uvAspectRatio: number = 1): Mesh {
    const geometry = new CircleBufferGeometry(size, 24);
    adjustUVs(geometry, uvAspectRatio);
    let material = new MeshBasicMaterial({
        transparent: true,
        side: DoubleSide,
    });

    const cube = new Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = false;
    return cube;
}

function adjustUVs(geometry: BufferGeometry, aspectRatio: number) {
    if (aspectRatio !== 1) {
        const uvs = geometry.getAttribute('uv') as Float32BufferAttribute;
        const count = uvs.count * 2;
        const inverse = 1 / aspectRatio;
        for (let i = 0; i < count; i += 2) {
            const x = (uvs.array[i] - 0.5) * inverse + 0.5;

            (uvs.array as number[])[i] = x;
        }
    }
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
 * Convert the Box3 object to a box2 object. Basically discards the Y components of the Box3's min and max.
 * @param box3 The Box3 to convert to a Box2.
 */
export function convertToBox2(box3: Box3): Box2 {
    return new Box2(
        new Vector2(box3.min.x, box3.min.z),
        new Vector2(box3.max.x, box3.max.z)
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
        scale.y * multiplier,
        scale.z * multiplier
    );
}

/**
 * Determines whether the given color means transparent.
 * @param color The color to check.
 */
export function isTransparent(color: string): boolean {
    return color === 'transparent' || color === 'clear';
}

const _bitmapReferences = new Map<ImageBitmap, Set<Texture>>();

const textureNames: (
    | keyof MeshBasicMaterial
    | keyof MeshStandardMaterial
    | keyof MeshToonMaterial
)[] = [
    'alphaMap',
    'envMap',
    'lightMap',
    'map',
    'specularMap',
    'bumpMap',
    'aoMap',
    'displacementMap',
    'emissiveMap',
    'metalnessMap',
    'normalMap',
    'specularMap',
    'roughnessMap',
];

const IMAGE_CACHE_KEY = Symbol('image_cache_key');

/**
 * Registers the textures in the given material as references so that future cleanup can be performed correctly.
 * @param material The material or list of materials to be registered
 */
export function registerMaterial(material: Material | Material[]) {
    if (!material) return;
    if (Array.isArray(material)) {
        material.forEach((m) => registerMaterial(m));
    } else {
        for (let tex of textureNames) {
            let t: Texture = (material as any)[tex];
            if (t) {
                let image = t.image;
                if (image instanceof ImageBitmap) {
                    let refs = _bitmapReferences.get(image);
                    if (!refs) {
                        refs = new Set();
                        _bitmapReferences.set(image, refs);
                    }
                    for (let key of Object.keys(Cache.files)) {
                        let value = Cache.files[key];
                        if (value === image) {
                            (image as any)[IMAGE_CACHE_KEY] = key;
                            break;
                        }
                    }

                    refs.add(t);
                }
            }
        }
    }
}

/**
 * Disposes the given material(s).
 * @param material The material(s) to dispose.
 * @param disposeTextures Whether the material's textures should be disposed.
 */
export function disposeMaterial(
    material: Material | Material[],
    disposeTextures: boolean = false
) {
    if (!material) return;
    if (Array.isArray(material)) {
        material.forEach((m) => disposeMaterial(m));
    } else {
        if (disposeTextures) {
            for (let tex of textureNames) {
                let t: Texture = (material as any)[tex];
                if (t) {
                    let image = t.image;
                    if (image instanceof ImageBitmap) {
                        let refs = _bitmapReferences.get(image);

                        let canDispose = false;
                        if (refs) {
                            refs.delete(t);
                            canDispose = refs.size === 0;
                        } else {
                            canDispose = true;
                        }

                        if (canDispose) {
                            if (IMAGE_CACHE_KEY in image) {
                                let cacheKey = (image as any)[IMAGE_CACHE_KEY];
                                Cache.remove(cacheKey);
                            }
                            _bitmapReferences.delete(image);
                            image.close();
                        }
                    }
                    t.dispose();
                }
            }
        }
        material.dispose();
    }
}

/**
 * Releases any unmanaged resources used by the given mesh.
 * @param mesh The mesh to dispose.
 * @param disposeGeometry Whether to dispose the mesh's geometry. Default true.
 * @param disposeMat Whether to dispose the mesh's material(s). Default true.
 * @param disposeTextures Whether to dispose the materials textures. Default false.
 */
export function disposeMesh(
    mesh: {
        geometry: BufferGeometry;
        material: Material | Material[];
    },
    disposeGeometry: boolean = true,
    disposeMat: boolean = true,
    disposeTextures: boolean = false
) {
    if (!mesh) return;
    if (disposeGeometry) {
        mesh.geometry.dispose();
    }
    if (disposeMat) {
        disposeMaterial(mesh.material, disposeTextures);
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

export const DEFAULT_COLOR = Symbol('default_color');
export const DEFAULT_OPACITY = Symbol('default_opacity');
export const DEFAULT_TRANSPARENT = Symbol('default_transparent');

/**
 * Changes the mesh's material to the given color.
 * @param mesh The mesh.
 * @param color The color in sRGB space.
 */
export function setColor(
    mesh: Mesh | Sprite | ThreeLineSegments,
    color: string
) {
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
        shapeMat.color = (<any>shapeMat)[DEFAULT_COLOR] ?? new Color(0xffffff);
    }
}

/**
 * Changes the mesh's opacity level.
 * @param mesh The mesh.
 * @param opacity The opacity value (0.0 -> 1.0)
 */
export function setOpacity(
    mesh: Mesh | Sprite | ThreeLineSegments,
    opacity: number
) {
    if (!mesh) {
        return;
    }

    const shapeMat = <
        MeshStandardMaterial | MeshToonMaterial | LineBasicMaterial
    >mesh.material;
    const prevTransparent = shapeMat.transparent;

    opacity = clamp(opacity, 0, 1);

    if (opacity < 1) {
        // Use given opacity as a modifier on the material's default opacity.
        const defaultOpacity = (<any>shapeMat)[DEFAULT_OPACITY] ?? 1;
        const newOpacity = defaultOpacity * opacity;

        shapeMat.transparent = true;
        shapeMat.opacity = newOpacity;
    } else {
        // Restore material to default values for opacity and transparency.
        shapeMat.transparent = (<any>shapeMat)[DEFAULT_TRANSPARENT] ?? false;
        shapeMat.opacity = (<any>shapeMat)[DEFAULT_OPACITY] ?? 1;
    }

    if (shapeMat.transparent !== prevTransparent) {
        // Changing transparent flag of material requires re-compilation of material.
        shapeMat.needsUpdate = true;
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
 * Creates a ray for the upward facing direction for the given camera.
 * @param camera The camera.
 */
export function cameraUpwardRay(camera: Camera): Ray {
    return objectWorldDirectionRay(new Vector3(0, 1, 0), camera);
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

/**
 * Creates a ray for the given object's upward direction.
 * @param obj The object.
 */
export function objectUpwardRay(obj: Object3D): Ray {
    return objectDirectionRay(new Vector3(0, 1, 0), obj);
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
    parent?.add(obj);
    return true;
}

export function calculateHitFace(hit: Intersection) {
    // Based on the normals of the bot the raycast hit, determine side of the cube
    if (hit.face) {
        if (hit.face.normal.x != 0) {
            if (hit.face.normal.x > 0) {
                return 'left';
            } else {
                return 'right';
            }
        } else if (hit.face.normal.y != 0) {
            if (hit.face.normal.y > 0) {
                return 'back';
            } else {
                return 'front';
            }
        } else if (hit.face.normal.z != 0) {
            if (hit.face.normal.z > 0) {
                return 'top';
            } else {
                return 'bottom';
            }
        }
    }
    return null;
}

/**
 * Calculates the intersection of the given cube and sphere.
 * @param cube The cube.
 * @param sphere The sphere.
 */
export function calculateCubeSphereIntersection(
    cube: Object3D,
    sphere: Sphere
) {
    const transform = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    cube.matrixWorld.decompose(transform, rotation, scale);

    // The position of the sphere relative to the cube
    const relativePosition = sphere.center.clone().sub(transform);

    const invertedRotation = rotation.clone().invert();

    // The axis aligned position of the sphere.
    // This ensures that the edges of the rectangle are axis aligned
    const axisAlignedPosition =
        relativePosition.applyQuaternion(invertedRotation);

    const halfScale = scale.clone().divideScalar(2);

    // Now that is is axis aligned, we can determine which corner the sphere is closest to.
    // From there, we can determine the closest point to the box
    const box = new Box3(
        new Vector3(-halfScale.x, -halfScale.y, -halfScale.z),
        new Vector3(halfScale.x, halfScale.y, halfScale.z)
    );

    let samplePosition = axisAlignedPosition;
    let distanceSign = 1;

    // If the sphere position is inside the box, move it to the nearest face
    if (box.containsPoint(axisAlignedPosition)) {
        const closestX = halfScale.x * (Math.sign(axisAlignedPosition.x) || 1);
        const closestY = halfScale.y * (Math.sign(axisAlignedPosition.y) || 1);
        const closestZ = halfScale.z * (Math.sign(axisAlignedPosition.z) || 1);

        const distX = closestX - axisAlignedPosition.x;
        const distY = closestY - axisAlignedPosition.y;
        const distZ = closestZ - axisAlignedPosition.z;

        if (distX <= distY && distX <= distZ) {
            samplePosition = new Vector3(
                closestX,
                axisAlignedPosition.y,
                axisAlignedPosition.z
            );
        } else if (distY <= distX && distY <= distZ) {
            samplePosition = new Vector3(
                axisAlignedPosition.x,
                closestY,
                axisAlignedPosition.z
            );
        } else {
            samplePosition = new Vector3(
                axisAlignedPosition.x,
                axisAlignedPosition.y,
                closestZ
            );
        }
        distanceSign = -1;
    }

    // Get the closest point by clamping the position to the box.
    const closestPoint = box.clampPoint(samplePosition, new Vector3());

    // Calculate the distance to the closest point from the sphere position.
    const squareDistanceToClosestPoint =
        closestPoint.distanceToSquared(samplePosition);
    const squareRadius = sphere.radius * sphere.radius;

    if (squareDistanceToClosestPoint <= squareRadius) {
        // There is an intersection.
        const faceNormal = closestPoint.clone();
        const absX = Math.abs(faceNormal.x);
        const absY = Math.abs(faceNormal.y);
        const absZ = Math.abs(faceNormal.z);
        let uv = new Vector2();
        if (absX >= absY && absX >= absZ) {
            // left/right face
            faceNormal.set(1 * Math.sign(faceNormal.x), 0, 0);

            uv.set(
                clamp(closestPoint.y / scale.y + 0.5, 0, 1),
                clamp(closestPoint.z / scale.z + 0.5, 0, 1)
            );
        } else if (absY >= absX && absY >= absZ) {
            // front/back face
            faceNormal.set(0, 1 * Math.sign(faceNormal.y), 0);
            uv.set(
                clamp(closestPoint.x / scale.x + 0.5, 0, 1),
                clamp(closestPoint.z / scale.z + 0.5, 0, 1)
            );
        } else {
            // top/bottom face
            faceNormal.set(0, 0, 1 * Math.sign(faceNormal.z));

            uv.set(
                clamp(closestPoint.x / scale.x + 0.5, 0, 1),
                clamp(closestPoint.y / scale.y + 0.5, 0, 1)
            );
        }

        const realDistance =
            axisAlignedPosition.distanceTo(closestPoint) * distanceSign;

        closestPoint.applyQuaternion(rotation);

        return {
            distance: realDistance,
            point: closestPoint,
            face: {
                normal: faceNormal,
            },
            uv: uv,
            object: cube,
        };
    } else {
        // no intersection
        return null;
    }
}

/**
 * Determines if the given bot is a child of the given parent bot.
 * @param child The child bot.
 * @param parent The parent bot.
 */
export function isBotChildOf(
    sim: Simulation,
    child: Bot,
    parent: Bot
): boolean {
    const maxDepth = 1000;
    let transformer = getBotTransformer(null, child);
    let index = 0;
    while (transformer && index < maxDepth) {
        if (transformer === parent.id) {
            return true;
        }
        const realParent = sim.helper.botsState[transformer];
        if (realParent) {
            transformer = getBotTransformer(null, child);
        } else {
            transformer = null;
        }
        index += 1;
    }

    return false;
}

/**
 * A matrix that can be premultiplied into another matrix to convert it from a left handed system
 * to a right-handed system.
 * Note that only works on individual rotations and not on entire transformations. (e.g. matrices with rotation + position)
 */
const CHANGE_ROTATION_Y_TO_Z_1 = new Matrix4().set(
    1,
    0,
    0,
    0,
    0,
    0,
    -1,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1
);

/**
 * A matrix can be be multiplied into another matrix to finish the conversion from a left handed system to a right handed system.
 * Note that only works on individual rotations and not on entire transformations. (e.g. matrices with rotation + position)
 */
const CHANGE_ROTATION_Y_TO_Z_2 = CHANGE_ROTATION_Y_TO_Z_1.clone().invert();

/**
 * A function that changes the given rotation matrix from three.js coordinates (Y-up) to AUX coordinates (Z-up).
 *
 * Note that this function only works on rotation-only matrices.
 * Matrices that contain translations will not function correctly since they have already bound the translations and rotations together.
 *
 * @param rotation The rotation to change.
 */
export function convertRotationToAuxCoordinates(rotation: Matrix4) {
    return rotation
        .premultiply(CHANGE_ROTATION_Y_TO_Z_1)
        .multiply(CHANGE_ROTATION_Y_TO_Z_2);
}

/**
 * A function that changes the given quaternion rotation from Aux coordinates (Z-up) to
 * @param rotation
 */
export function getThreeJSQuaternionFromBotRotation(rotation: {
    x: number;
    y: number;
    z: number;
    w?: number;
}) {
    if ('w' in rotation) {
    } else {
        return new Quaternion().setFromEuler(
            new Euler(rotation.x, rotation.z, rotation.y, 'XYZ')
        );
    }
}

/**
 * Parses special CasualOS URLs into an object that indicates what it should be used for.
 * Currently only supports "casualos://camera-feed/{rear|front}".
 * Returns null if the URL has no special CasualOS meaning.
 * @param url The URL that should be parsed.
 * @returns
 */
export function parseCasualOSUrl(
    url: string | Partial<URL>
): ParsedCasualOSUrl {
    try {
        const uri = typeof url === 'object' ? url : new URL(url);
        if (uri.protocol !== 'casualos:') {
            return null;
        }

        if (uri.hostname === 'camera-feed') {
            let camera: CameraType;
            if (uri.pathname === '/front') {
                camera = 'front';
            } else if (uri.pathname === '/rear') {
                camera = 'rear';
            }

            let result: ParsedCasualOSUrl = {
                type: 'camera-feed',
            };

            if (camera) {
                result.camera = camera;
            }

            return result;
        } else if (uri.hostname === 'video-element') {
            let result: ParsedCasualOSUrl = {
                type: 'video-element',
                address: uri.href,
            };

            return result;
        } else if (uri.hostname === '') {
            // Chrome/Firefox
            // See https://bugs.chromium.org/p/chromium/issues/detail?id=869291 and https://bugzilla.mozilla.org/show_bug.cgi?id=1374505
            if (uri.pathname.startsWith('//camera-feed')) {
                let path = uri.pathname.slice('//camera-feed'.length);
                let camera: CameraType;
                if (path === '/front') {
                    camera = 'front';
                } else if (path === '/rear') {
                    camera = 'rear';
                }

                let result: ParsedCasualOSUrl = {
                    type: 'camera-feed',
                };

                if (camera) {
                    result.camera = camera;
                }

                return result;
            } else if (uri.pathname.startsWith('//video-element')) {
                let result: ParsedCasualOSUrl = {
                    type: 'video-element',
                    address: uri.href,
                };

                return result;
            }
        }

        return null;
    } catch {
        return null;
    }
}

export function addCorsQueryParam(url: string): string {
    let uri = new URL(url);

    if (
        uri.searchParams.has('casualos-no-cors-cache') &&
        uri.searchParams.get('casualos-no-cors-cache') === 'true'
    ) {
        uri.searchParams.delete('casualos-no-cors-cache');
    } else if (
        !uri.searchParams.has('cors-cache') &&
        (uri.protocol === 'http:' ||
            uri.protocol === 'https:' ||
            uri.protocol === 'ws:' ||
            uri.protocol === 'wss:')
    ) {
        uri.searchParams.set('cors-cache', '');
    }

    return uri.href;
}

export type ParsedCasualOSUrl = CasualOSCameraFeedUrl | CasualOSVideoElementUrl;

export interface CasualOSCameraFeedUrl {
    type: 'camera-feed';
    camera?: CameraType;
}

export interface CasualOSVideoElementUrl {
    type: 'video-element';
    address: string;
}

export type TweenCameraPosition = GridCameraPosition | WorldCameraPosition;

export interface WorldCameraPosition {
    type: 'world';
    position: Vector3;
}

export interface GridCameraPosition {
    type: 'grid';
    position: Vector3;
}
