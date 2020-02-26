import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { LegacyGLTFLoader } from 'three-legacy-gltf-loader';
import { Scene, AnimationClip } from 'three';

const loader = new GLTFLoader();
const legacy = new LegacyGLTFLoader();
const pools = new Map<string, GLTFPool>();

/**
 * Loads a GLTF file from the given URL using the new GLTF loader.
 * @param url The url.
 */
export function loadNewGLTF(url: string): Promise<GLTF> {
    return _loadGLTF(url, loader);
}

/**
 * Loads a GLTF file from the given URl using the legacy loader.
 * @param url The url.
 */
export function loadOldGLTF(url: string): Promise<GLTF> {
    return _loadGLTF(url, legacy);
}

/**
 * Gets a GLTF Pool with the given name.
 * @param name The name of the pool to load.
 */
export function getGLTFPool(name: string): GLTFPool {
    let pool = pools.get(name);
    if (!pool) {
        pool = new GLTFPool();
        pools.set(name, pool);
    }
    return pool;
}

/**
 * Defines a class that represents a pool of GLTF meshes that were loaded.
 */
export class GLTFPool {
    private _cache = new Map<string, Promise<GLTF>>();

    async loadGLTF(
        url: string,
        useLegacyLoader: boolean = false
    ): Promise<GLTF> {
        let promise = this._cache.get(url);
        if (!promise) {
            promise = useLegacyLoader ? loadOldGLTF(url) : loadNewGLTF(url);
            this._cache.set(url, promise);
        }
        const gltf = await promise;

        return _cloneGLTF(gltf);
    }
}

function _cloneGLTF(gltf: GLTF): GLTF {
    const animations = gltf.animations.map(anim => {
        const json = (<any>AnimationClip.toJSON)(anim);
        return AnimationClip.parse(json);
    });
    const scene = gltf.scene.clone(true);

    return {
        asset: gltf.asset,
        animations,
        cameras: [],
        scenes: [scene],
        scene,
        parser: null,
        userData: {},
    };
}

function _loadGLTF(
    url: string,
    loader: GLTFLoader | LegacyGLTFLoader
): Promise<GLTF> {
    return new Promise((resolve, reject) => {
        loader.load(url, gltf => resolve(gltf), null, err => reject(err));
    });
}
