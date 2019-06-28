import {
    Object3D,
    Box3,
    Color,
    MeshPhongMaterial,
    MeshPhongMaterialParameters,
    Texture,
} from 'three';

declare module 'three' {
    class MeshToonMaterial extends MeshPhongMaterial {
        defines: any;
        gradientMap: Texture;
        isMeshToonMaterial: boolean;

        constructor(parameters: MeshPhongMaterialParameters);
    }
}
