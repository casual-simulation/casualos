import {
    AnimationClip,
    Camera,
    LoadingManager,
    Scene,
  } from 'three';
import {GLTF} from 'three/examples/jsm/loaders/GLTFLoader';
  
export class LegacyGLTFLoader {
    constructor(manager?: LoadingManager);
    manager: LoadingManager;
    path: string;

    load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void) : void;
    setPath(path: string) : LegacyGLTFLoader;
    setResourcePath(path: string) : LegacyGLTFLoader;
    setCrossOrigin(value: string): LegacyGLTFLoader;
    setDRACOLoader(dracoLoader: object): LegacyGLTFLoader;
    parse(data: ArrayBuffer | string, path: string, onLoad: (gltf: GLTF) => void, onError?: (event: ErrorEvent) => void) : void;
}