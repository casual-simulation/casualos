declare module 'three.meshline' {
    import { Material, Color, BufferGeometry } from '@casual-simulation/three';

    export class MeshLine extends BufferGeometry {
        setPoints(
            points: number[],
            getPointWidth?: (percent: number) => number
        ): void;
        setPoints(
            geometry: BufferGeometry,
            getPointWidth?: (percent: number) => number
        ): void;
    }

    export class MeshLineMaterial extends Material {
        color: Color;
        lineWidth: number;
        sizeAttenuation: boolean;

        dashArray: number;
        dashRatio: number;

        constructor(parameters?: any);
    }
}
