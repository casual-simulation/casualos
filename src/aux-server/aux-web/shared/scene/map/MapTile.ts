/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Material } from '@casual-simulation/three';
import {
    Color,
    DoubleSide,
    MeshPhongMaterial,
    Vector3,
} from '@casual-simulation/three';
import { MapHeightNodeShader, TextureUtils, type MapProvider } from 'geo-three';
import {
    FrontSide,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    Object3D,
    PlaneGeometry,
    RGBAFormat,
    ShaderMaterial,
    Side,
    Texture,
} from 'three';
// import VertexShader from './shaders/VertexShader.glsl?raw';
// import FragmentShader from './shaders/FragmentShader.glsl?raw';

const ZOOM_SCALES = new Map<number, number>([
    [1, 1 / 78271.517],
    [2, 1 / 39135.7585],
    [3, 1 / 19567.8792],
    [4, 1 / 9783.9396],
    [5, 1 / 4891.9698],
    [6, 1 / 2445.9849],
    [7, 1 / 1222.9925],
    [8, 1 / 611.4962],
    [9, 1 / 305.7481],
    [10, 1 / 152.8741],
    [11, 1 / 76.437],
    [12, 1 / 38.2185],
    [13, 1 / 19.1093],
    [14, 1 / 9.5546],
    [15, 1 / 4.7773],
    [16, 1 / 2.3887],
    [17, 1 / 1.1943],
    [18, 1 / 0.5972],
    [19, 1 / 0.2986],
    [20, 1 / 0.1493],
    [21, 1 / 0.0746],
    [22, 1 / 0.0373],
    [23, 1 / 0.0187],
]);

export class MapTile extends Object3D {
    private _provider: MapProvider;
    private _heightProvider: MapProvider;
    private _plane: Mesh;
    private _container: Object3D;
    private _scaleContainer: Object3D;
    private _heightOffset: number = 0;

    private static _GRID_WIDTH = 256;
    private static _GRID_HEIGHT = 256;

    // private static _SEA_LEVEL_TEXTURE = TextureUtils.createFillTexture('#0186a0');

    y: number = 0;
    x: number = 0;
    zoom: number = 1;

    private get _material(): THREE.MeshBasicMaterial {
        return this._plane.material as THREE.MeshBasicMaterial;
    }

    setHeightProvider(provider: MapProvider | null) {
        this._heightProvider = provider;
        this._loadHeightTexture();
    }

    constructor(
        provider: MapProvider,
        heightProvider: MapProvider | null = null
    ) {
        super();
        this._provider = provider;
        this._heightProvider = heightProvider;
        this._plane = new Mesh(
            // new PlaneGeometry(1, 1),
            new PlaneGeometry(1, 1, MapTile._GRID_WIDTH, MapTile._GRID_HEIGHT),
            // new MeshBasicMaterial({ wireframe: false, side: FrontSide }),
            MapTile.prepareMaterial(
                new MeshBasicMaterial({ wireframe: false, side: DoubleSide })
            )
            // MapTile.prepareMaterial(new MeshPhongMaterial({ wireframe: false, side: FrontSide })),
        );
        this._plane.setRotationFromAxisAngle(
            new Vector3(1, 0, 0),
            -Math.PI / 2
        );
        this._container = new Object3D();
        this._container.add(this._plane);

        this._scaleContainer = new Object3D();
        this._scaleContainer.add(this._container);
        this.add(this._scaleContainer);
    }

    setTile(zoom: number, x: number, y: number) {
        console.log('Set tile', zoom, x, y);
        this.zoom = zoom;
        this.y = y;
        this.x = x;

        this._loadTexture();
    }

    setClip(width: number, height: number, anchor: Vector3) {
        this._scaleContainer.position.set(anchor.x, anchor.y, anchor.z);
        this._plane.position.set(-anchor.x, -anchor.y, -anchor.z);

        this._scaleContainer.scale.set(width, 1, height);
        this._scaleContainer.updateMatrixWorld(true);

        // update UVs so that there is new stretching/squishing
        const geometry = this._plane.geometry as PlaneGeometry;
        const uvAttribute = geometry.attributes.uv;
        const uvArray = uvAttribute.array as Float32Array;

        let uvLeft = 0;
        let uvRight = 1;
        if (anchor.x > 0) {
            uvLeft = 1 - width;
        } else if (anchor.x < 0) {
            uvRight = width;
        }

        let uvTop = 1;
        let uvBottom = 0;
        if (anchor.z > 0) {
            uvTop = height;
        } else if (anchor.z < 0) {
            uvBottom = 1 - height;
        }

        const gridX = MapTile._GRID_WIDTH;
        const gridY = MapTile._GRID_HEIGHT;
        const gridX1 = gridX + 1;
        const gridY1 = gridY + 1;

        // rebuild the UVs based on the grid size
        let idx = 0;
        for (let iy = 0; iy < gridY1; iy++) {
            for (let ix = 0; ix < gridX1; ix++) {
                const x = ix / gridX;

                // x === 0 : uvLeft
                // x === 1 : uvRight
                uvArray[idx] = x * (uvRight - uvLeft) + uvLeft;

                const y = iy / gridY;

                // y === 0 : uvTop
                // y === 1 : uvBottom
                uvArray[idx + 1] = y * (uvBottom - uvTop) + uvTop;
                idx += 2;
            }
        }

        uvAttribute.needsUpdate = true;
        if (this._material.map) {
            this._material.map.needsUpdate = true;
        }
        this._material.needsUpdate = true;
    }

    setHeightOffset(heightOffset: number) {
        this._heightOffset = heightOffset;
        const heightOffsetUniform: { value: number } =
            this._material.userData.heightOffset;
        if (heightOffsetUniform && heightOffsetUniform.value) {
            heightOffsetUniform.value = this._heightOffset;
        }
        this._material.needsUpdate = true;
    }

    static prepareMaterial(material: Material): Material {
        material.userData = {
            heightMap: { value: null },
            heightScale: { value: 0.0 },
            heightOffset: { value: 0.0 },
        };

        material.onBeforeCompile = (shader: any) => {
            // Pass uniforms from userData to the
            for (const i in material.userData) {
                shader.uniforms[i] = material.userData[i];
            }

            // Vertex variables
            shader.vertexShader =
                `
            uniform sampler2D heightMap;
            uniform float heightScale;
            uniform float heightOffset;
            // varying vec2 vUv;
            ` + shader.vertexShader;

            // Vertex depth logic
            shader.vertexShader = shader.vertexShader.replace(
                '#include <fog_vertex>',
                `
            #include <fog_vertex>

            // Calculate height of the title
            vec4 _theight = texture2D(heightMap, vUv);
            float _height = ((_theight.r * 256.0 * 256.0 + _theight.g * 256.0 + _theight.b) * heightScale) - (390.0 * heightScale * 0.0039) + heightOffset;
            vec3 _transformed = position + _height * normal;

            // Vertex position based on height
            gl_Position = projectionMatrix * modelViewMatrix * vec4(_transformed, 1.0);
            `
            );
        };

        return material;
    }

    private async _loadTexture() {
        const image: HTMLImageElement = await this._provider.fetchTile(
            this.zoom,
            this.x,
            this.y
        );
        const texture = new Texture(image);
        texture.generateMipmaps = false;
        texture.format = RGBAFormat;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;
        texture.needsUpdate = true;

        if (this._material.map) {
            this._material.map.dispose();
        }

        this._material.map = texture;
        this._material.needsUpdate = true;

        this._loadHeightTexture();
    }

    private async _loadHeightTexture() {
        if (this._heightProvider) {
            const heightImage: HTMLImageElement =
                await this._heightProvider.fetchTile(this.zoom, this.x, this.y);
            const heightTexture = new Texture(heightImage);
            heightTexture.generateMipmaps = false;
            heightTexture.format = RGBAFormat;
            heightTexture.magFilter = LinearFilter;
            heightTexture.minFilter = LinearFilter;
            heightTexture.needsUpdate = true;

            const heightMap: { value: unknown } =
                this._material.userData.heightMap;
            if (
                heightMap &&
                heightMap.value &&
                heightMap.value instanceof Texture
            ) {
                heightMap.value.dispose();
            }
            this._material.userData.heightScale.value = ZOOM_SCALES.get(
                this.zoom
            );
            this._material.userData.heightOffset.value = 0.0;
            this._material.userData.heightMap.value = heightTexture;
            this._plane.frustumCulled = false;
        } else {
            const heightMap: { value: unknown } =
                this._material.userData.heightMap;
            if (
                heightMap &&
                heightMap.value &&
                heightMap.value instanceof Texture
            ) {
                heightMap.value.dispose();
            }
            this._material.userData.heightScale.value = 0.0;
            this._material.userData.heightOffset.value = 0.0;
            this._material.userData.heightMap.value = null;
            this._plane.frustumCulled = true;
        }

        this._material.needsUpdate = true;
    }

    dispose() {
        if (this._material.map) {
            this._material.map.dispose();
        }
        const heightMap: { value: unknown } = this._material.userData.heightMap;
        if (
            heightMap &&
            heightMap.value &&
            heightMap.value instanceof Texture
        ) {
            heightMap.value.dispose();
        }
        this._material.dispose();
        this._plane.geometry.dispose();
        this._container.remove(this._plane);
        this.remove(this._scaleContainer);
        this._scaleContainer.remove(this._container);
        this._provider = null;
    }
}
