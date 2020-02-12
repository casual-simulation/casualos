import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { LegacyGLTFLoader } from 'three-legacy-gltf-loader';

const loader = new GLTFLoader();
const legacy = new LegacyGLTFLoader();

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

function _loadGLTF(
    url: string,
    loader: GLTFLoader | LegacyGLTFLoader
): Promise<GLTF> {
    return new Promise((resolve, reject) => {
        loader.load(url, gltf => resolve(gltf), null, err => reject(err));
    });
}
