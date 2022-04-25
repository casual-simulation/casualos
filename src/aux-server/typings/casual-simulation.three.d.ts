declare module '@casual-simulation/three' {
    export * from 'three';
    import { MaterialParameters, Color, Texture, Material, NormalMapTypes, Vector2 } from 'three';

    
    export interface MeshToonMaterialParameters extends MaterialParameters {
        /** geometry color in hexadecimal. Default is 0xffffff. */
        color?: Color | string | number;
        specular?: Color | string | number;
        shininess?: number;
        opacity?: number;
        gradientMap?: Texture | null;
        map?: Texture | null;
        lightMap?: Texture | null;
        lightMapIntensity?: number;
        aoMap?: Texture | null;
        aoMapIntensity?: number;
        emissive?: Color | string | number;
        emissiveIntensity?: number;
        emissiveMap?: Texture | null;
        bumpMap?: Texture | null;
        bumpScale?: number;
        normalMap?: Texture | null;
        normalMapType?: NormalMapTypes;
        normalScale?: Vector2;
        displacementMap?: Texture | null;
        displacementScale?: number;
        displacementBias?: number;
        specularMap?: Texture | null;
        alphaMap?: Texture | null;
        wireframe?: boolean;
        wireframeLinewidth?: number;
        wireframeLinecap?: string;
        wireframeLinejoin?: string;
        skinning?: boolean;
        morphTargets?: boolean;
        morphNormals?: boolean;
    }

    export class MeshToonMaterial extends Material {

        constructor( parameters?: MeshToonMaterialParameters );

        /**
         * @default 'MeshToonMaterial'
         */
        type: string;

        /**
         * @default { 'TOON': '' }
         */
        defines: { [key: string]: any };

        /**
         * @default new THREE.Color( 0xffffff )
         */
        color: Color;
        specular: Color;
        shininess: number;
        gradientMap: Texture | null;

        /**
         * @default null
         */
        map: Texture | null;

        /**
         * @default null
         */
        lightMap: Texture | null;

        /**
         * @default 1
         */
        lightMapIntensity: number;

        /**
         * @default null
         */
        aoMap: Texture | null;

        /**
         * @default 1
         */
        aoMapIntensity: number;

        /**
         * @default new THREE.Color( 0x000000 )
         */
        emissive: Color;

        /**
         * @default 1
         */
        emissiveIntensity: number;

        /**
         * @default null
         */
        emissiveMap: Texture | null;

        /**
         * @default null
         */
        bumpMap: Texture | null;

        /**
         * @default 1
         */
        bumpScale: number;

        /**
         * @default null
         */
        normalMap: Texture | null;

        /**
         * @default THREE.TangentSpaceNormalMap
         */
        normalMapType: NormalMapTypes;

        /**
         * @default new THREE.Vector2( 1, 1 )
         */
        normalScale: Vector2;

        /**
         * @default null
         */
        displacementMap: Texture | null;

        /**
         * @default 1
         */
        displacementScale: number;

        /**
         * @default 0
         */
        displacementBias: number;
        specularMap: Texture | null;
        /**
         * @default null
         */
        alphaMap: Texture | null;

        /**
         * @default false
         */
        wireframe: boolean;

        /**
         * @default 1
         */
        wireframeLinewidth: number;

        /**
         * @default 'round'
         */
        wireframeLinecap: string;

        /**
         * @default 'round'
         */
        wireframeLinejoin: string;

        /**
         * @default false
         */
        skinning: boolean;

        /**
         * @default false
         */
        morphTargets: boolean;

        /**
         * @default false
         */
        morphNormals: boolean;

        setValues( parameters: MeshToonMaterialParameters ): void;

    }
}

declare module '@casual-simulation/three/examples/jsm/lines/Line2' {
    export * from 'three/examples/jsm/lines/Line2';
}

declare module '@casual-simulation/three/examples/jsm/lines/LineGeometry' {
    export * from 'three/examples/jsm/lines/LineGeometry';
}

declare module '@casual-simulation/three/examples/jsm/lines/LineMaterial' {
    export * from 'three/examples/jsm/lines/LineMaterial';
}

declare module '@casual-simulation/three/examples/jsm/loaders/GLTFLoader' {
    export * from 'three/examples/jsm/loaders/GLTFLoader';
}

declare module '@casual-simulation/three/examples/jsm/loaders/DRACOLoader' {
    export * from 'three/examples/jsm/loaders/DRACOLoader';
}

declare module '@casual-simulation/three/examples/jsm/renderers/CSS3DRenderer' {
    export * from 'three/examples/jsm/renderers/CSS3DRenderer';
}