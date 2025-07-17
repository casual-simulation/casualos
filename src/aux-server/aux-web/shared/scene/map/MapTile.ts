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
    Vector3,
    Vector2,
    Float32BufferAttribute,
    BufferGeometry as ThreeBufferGeometry,
    PointsMaterial as ThreePointsMaterial,
    LineBasicMaterial as ThreeLineBasicMaterial,
    MeshBasicMaterial as ThreeMeshBasicMaterial,
    Points as ThreePoints,
    Line as ThreeLine,
    Mesh as ThreeMesh,
    Group as ThreeGroup,
    Shape,
    ShapeGeometry,
} from '@casual-simulation/three';
import type { MapProvider } from 'geo-three';
import { TextureUtils } from 'geo-three';
import {
    FrontSide,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    RGBAFormat,
    Texture,
} from '@casual-simulation/three';
import type { BBox } from 'geojson';
import { buildSRGBColor } from '../SceneUtils';
import type { GeoJSONFeature, GeoJSONStyle } from './GeoJSONTypes';

/**
 * Map of zoom levels to scale values.
 * The scale values map 1 unit to 1 pixel.
 */
const ZOOM_SCALES = new Map<number, number>([
    [1, 0.00001277603959049369],
    [2, 0.00002555207918098738],
    [3, 0.00005110415849255652],
    [4, 0.00002555207924627826],
    [5, 0.00005110415849255652],
    [6, 0.00010220831698511304],
    [7, 0.00020441662561299434],
    [8, 0.0004088332846549169],
    [9, 0.0008176665693098337],
    [10, 0.0016353326037569476],
    [11, 0.003270667346965475],
    [12, 0.00654133469393095],
    [13, 0.013082635156703803],
    [14, 0.026165407238398258],
    [15, 0.20932325790718606],
    [16, 0.4186377527525432],
    [17, 0.8373105584861426],
    [18, 1.6744809109176158],
    [19, 3.3489618218352315],
    [20, 6.697923643670463],
    [21, 13.404825737265416],
    [22, 26.80965147453083],
    [23, 53.475935828877],
]);

export class MapTile extends Object3D {
    private _provider: MapProvider;
    private _heightProvider: MapProvider | null;
    private _plane: Mesh;
    private _container: Object3D;
    private _scaleContainer: Object3D;
    private _heightOffset: number = 0.0;
    private _usingHeightMaterial: boolean = false;
    private _y: number = 0;
    private _x: number = 0;
    private _zoom: number = 1;
    private _currentTileRequestId: number = 0;
    private _currentHeightTileRequestId: number = 0;

    // GeoJSON feature rendering containers
    private _featuresContainer: ThreeGroup;
    private _pointsContainer: ThreeGroup;
    private _linesContainer: ThreeGroup;
    private _polygonsContainer: ThreeGroup;

    // Current features and bounds
    private _features: GeoJSONFeature[] = [];
    private _tileBounds: BBox | null = null;
    private _defaultStyle: GeoJSONStyle = {
        pointColor: '#ff0000',
        pointSize: 5,
        lineColor: '#0000ff',
        lineWidth: 2,
        lineOpacity: 1.0,
        fillColor: '#00ff00',
        fillOpacity: 0.7,
        strokeColor: '#000000',
        strokeWidth: 1,
    };

    // Clipping state
    private _clipWidth: number = 1;
    private _clipHeight: number = 1;
    private _clipAnchor: Vector3 = new Vector3(0, 0, 0);

    // Renderer resolution for line rendering
    private _rendererResolution: Vector2 = new Vector2(1920, 1080);

    private static _GRID_WIDTH = 256;
    private static _GRID_HEIGHT = 256;
    private static _SEA_LEVEL_TEXTURE =
        TextureUtils.createFillTexture('#000000');

    private get _material(): THREE.MeshBasicMaterial {
        return this._plane.material as THREE.MeshBasicMaterial;
    }

    constructor(
        provider: MapProvider,
        heightProvider: MapProvider | null = null
    ) {
        super();
        this._provider = provider;
        this._heightProvider = heightProvider;
        this._plane = new Mesh(
            new PlaneGeometry(1, 1, MapTile._GRID_WIDTH, MapTile._GRID_HEIGHT),
            new MeshBasicMaterial({ wireframe: false, side: FrontSide })
        );
        this._plane.setRotationFromAxisAngle(
            new Vector3(1, 0, 0),
            -Math.PI / 2
        );
        this._container = new Object3D();
        this._container.add(this._plane);

        // Initialize GeoJSON containers
        this._featuresContainer = new ThreeGroup();
        this._featuresContainer.name = 'TileFeatures';

        this._pointsContainer = new ThreeGroup();
        this._pointsContainer.name = 'TilePoints';

        this._linesContainer = new ThreeGroup();
        this._linesContainer.name = 'TileLines';

        this._polygonsContainer = new ThreeGroup();
        this._polygonsContainer.name = 'TilePolygons';

        this._featuresContainer.add(this._pointsContainer);
        this._featuresContainer.add(this._linesContainer);
        this._featuresContainer.add(this._polygonsContainer);

        // Add features container to the main container so it gets same transforms
        this._container.add(this._featuresContainer);

        this._scaleContainer = new Object3D();
        this._scaleContainer.add(this._container);
        this.add(this._scaleContainer);

        this._setupMaterial();
    }

    /**
     * Sets the height offset for the tile.
     * @param heightOffset The height offset to set.
     */
    setHeightOffset(heightOffset: number) {
        if (this._heightOffset === heightOffset) {
            return;
        }
        this._heightOffset = heightOffset;
        if (this._usingHeightMaterial) {
            const heightOffsetUniform: { value: number } =
                this._material.userData.heightOffset;
            if (heightOffsetUniform) {
                heightOffsetUniform.value = this._heightOffset;
            }
            this._material.needsUpdate = true;
        }
    }

    /**
     * Sets the height provider for the tile.
     * If null, then the tile will not display height information.
     * @param provider
     */
    setHeightProvider(provider: MapProvider | null) {
        this._heightProvider = provider;
        this._setupMaterial();
        this._loadHeightTexture();
    }

    private _setupMaterial() {
        const previousMaterial = this._material;
        if (this._heightProvider && !this._usingHeightMaterial) {
            this._usingHeightMaterial = true;
            this._plane.material = MapTile.prepareMaterial(
                new MeshBasicMaterial({ wireframe: false, side: FrontSide })
            );
            this._material.map = previousMaterial.map;
        } else if (!this._heightProvider && this._usingHeightMaterial) {
            this._usingHeightMaterial = false;
            this._plane.material = new MeshBasicMaterial({
                wireframe: false,
                side: FrontSide,
            });
            this._material.map = previousMaterial.map;
        }
    }

    setProvider(provider: MapProvider) {
        this._provider = provider;
        this._loadTexture();
    }

    /**
     * Sets the tile that should be displayed.
     * @param zoom The zoom level of the tile.
     * @param x The x coordinate of the tile.
     * @param y The Y coordinate of the tile.
     */
    setTile(zoom: number, x: number, y: number) {
        this._zoom = zoom;
        this._y = y;
        this._x = x;

        // Calculate tile bounds in geographic coordinates
        this._tileBounds = this._calculateTileBounds(zoom, x, y);

        this._loadTexture();
        // Features will be set by MapView after setTile
    }

    /**
     * Calculate geographic bounds for this tile
     */
    private _calculateTileBounds(zoom: number, x: number, y: number): BBox {
        const n = Math.pow(2, zoom);

        // Calculate bounds
        const west = (x / n) * 360 - 180;
        const east = ((x + 1) / n) * 360 - 180;
        const north =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
        const south =
            (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) /
            Math.PI;

        return [west, south, east, north];
    }

    /**
     * Set GeoJSON features for this tile
     * Features should already be clipped to tile bounds by MapView
     */
    setFeatures(features: GeoJSONFeature[], defaultStyle?: GeoJSONStyle) {
        // Clear existing features
        this._clearFeatures();

        if (defaultStyle) {
            this._defaultStyle = { ...this._defaultStyle, ...defaultStyle };
        }

        this._features = features;
        this._renderFeatures();
    }

    /**
     * Set renderer resolution for proper line width rendering
     */
    setRendererResolution(width: number, height: number) {
        this._rendererResolution.set(width, height);

        // Update any existing wide lines
        // Note: In this simplified version, we're using basic lines
        // If you implement wide lines later, update their resolution here
    }

    /**
     * Clear all rendered features
     */
    private _clearFeatures() {
        // Clear points
        while (this._pointsContainer.children.length > 0) {
            const child = this._pointsContainer.children[0];
            this._pointsContainer.remove(child);
            if ('geometry' in child) (child as any).geometry.dispose();
            if ('material' in child) (child as any).material.dispose();
        }

        // Clear lines
        while (this._linesContainer.children.length > 0) {
            const child = this._linesContainer.children[0];
            this._linesContainer.remove(child);
            if ('geometry' in child) (child as any).geometry.dispose();
            if ('material' in child) (child as any).material.dispose();
        }

        // Clear polygons
        while (this._polygonsContainer.children.length > 0) {
            const child = this._polygonsContainer.children[0];
            this._polygonsContainer.remove(child);
            if ('geometry' in child) (child as any).geometry.dispose();
            if ('material' in child) (child as any).material.dispose();
        }
    }

    /**
     * Render all features for this tile
     */
    private _renderFeatures() {
        if (!this._tileBounds) return;

        for (const feature of this._features) {
            this._renderFeature(feature);
        }
    }

    /**
     * Render a single feature
     */
    private _renderFeature(feature: GeoJSONFeature) {
        if (!feature.geometry) return;

        const style = this._getFeatureStyle(feature);

        switch (feature.geometry.type) {
            case 'Point':
                this._renderPoint(feature.geometry.coordinates, style);
                break;
            case 'LineString':
                this._renderLineString(feature.geometry.coordinates, style);
                break;
            case 'Polygon':
                this._renderPolygon(feature.geometry.coordinates, style);
                break;
            case 'MultiPoint':
                this._renderMultiPoint(feature.geometry.coordinates, style);
                break;
            case 'MultiLineString':
                this._renderMultiLineString(
                    feature.geometry.coordinates,
                    style
                );
                break;
            case 'MultiPolygon':
                this._renderMultiPolygon(feature.geometry.coordinates, style);
                break;
        }
    }

    /**
     * Convert geographic coordinates to tile-local coordinates
     * This accounts for the tile's position and the clip transforms
     */
    private _geoToTileLocal(lon: number, lat: number): Vector3 {
        if (!this._tileBounds) return new Vector3();

        const [west, south, east, north] = this._tileBounds;

        // Convert to normalized tile coordinates (0-1)
        const x = (lon - west) / (east - west);
        const y = (lat - south) / (north - south);

        // Convert to tile-local coordinates (-0.5 to 0.5)
        // Note: we flip Y because geographic coordinates have Y increasing northward
        // but our 3D coordinates have Z increasing southward
        return new Vector3(x - 0.5, 0, 0.5 - y);
    }

    /**
     * Get style for a feature
     */
    private _getFeatureStyle(feature: GeoJSONFeature): GeoJSONStyle {
        const style = { ...this._defaultStyle };

        // Override with feature properties
        if (feature.properties) {
            Object.keys(style).forEach((key) => {
                if (feature.properties![key] !== undefined) {
                    (style as any)[key] = feature.properties![key];
                }
            });
        }

        return style;
    }

    /**
     * Render point geometry
     */
    private _renderPoint(coordinates: number[], style: GeoJSONStyle) {
        const [lon, lat] = coordinates;
        const localPos = this._geoToTileLocal(lon, lat);

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute([localPos.x, localPos.y, localPos.z], 3)
        );

        const material = new ThreePointsMaterial({
            color: buildSRGBColor(style.pointColor!),
            size: style.pointSize!,
            sizeAttenuation: false,
        });

        const points = new ThreePoints(geometry, material);
        this._pointsContainer.add(points);
    }

    /**
     * Render LineString geometry
     */
    private _renderLineString(coordinates: number[][], style: GeoJSONStyle) {
        const positions: number[] = [];

        for (const coord of coordinates) {
            const [lon, lat] = coord;
            const localPos = this._geoToTileLocal(lon, lat);
            positions.push(localPos.x, localPos.y, localPos.z);
        }

        const geometry = new ThreeBufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(positions, 3)
        );

        const material = new ThreeLineBasicMaterial({
            color: buildSRGBColor(style.lineColor!),
            transparent: style.lineOpacity! < 1,
            opacity: style.lineOpacity!,
        });

        const line = new ThreeLine(geometry, material);
        this._linesContainer.add(line);
    }

    /**
     * Render Polygon geometry
     */
    private _renderPolygon(coordinates: number[][][], style: GeoJSONStyle) {
        if (!coordinates || coordinates.length === 0) return;

        const exteriorRing = coordinates[0];
        const holes = coordinates.slice(1);

        // Create shape
        const shape = new Shape();
        let firstPoint = true;

        for (const coord of exteriorRing) {
            const [lon, lat] = coord;
            const localPos = this._geoToTileLocal(lon, lat);

            if (firstPoint) {
                shape.moveTo(localPos.x, localPos.z);
                firstPoint = false;
            } else {
                shape.lineTo(localPos.x, localPos.z);
            }
        }

        // Add holes
        for (const hole of holes) {
            const holePath = new Shape();
            let firstHolePoint = true;

            for (const coord of hole) {
                const [lon, lat] = coord;
                const localPos = this._geoToTileLocal(lon, lat);

                if (firstHolePoint) {
                    holePath.moveTo(localPos.x, localPos.z);
                    firstHolePoint = false;
                } else {
                    holePath.lineTo(localPos.x, localPos.z);
                }
            }

            shape.holes.push(holePath);
        }

        const geometry = new ShapeGeometry(shape);
        const material = new ThreeMeshBasicMaterial({
            color: buildSRGBColor(style.fillColor!),
            transparent: style.fillOpacity! < 1,
            opacity: style.fillOpacity!,
            side: 2, // DoubleSide
        });

        const mesh = new ThreeMesh(geometry, material);
        mesh.rotateX(-Math.PI / 2); // Rotate to lie flat
        this._polygonsContainer.add(mesh);
    }

    /**
     * Render MultiPoint geometry
     */
    private _renderMultiPoint(coordinates: number[][], style: GeoJSONStyle) {
        for (const coord of coordinates) {
            this._renderPoint(coord, style);
        }
    }

    /**
     * Render MultiLineString geometry
     */
    private _renderMultiLineString(
        coordinates: number[][][],
        style: GeoJSONStyle
    ) {
        for (const lineCoords of coordinates) {
            this._renderLineString(lineCoords, style);
        }
    }

    /**
     * Render MultiPolygon geometry
     */
    private _renderMultiPolygon(
        coordinates: number[][][][],
        style: GeoJSONStyle
    ) {
        for (const polygonCoords of coordinates) {
            this._renderPolygon(polygonCoords, style);
        }
    }

    /**
     * Positions and clips the tile to the given width, height, and anchor.
     * This function is used to adjust a tile so that it only displays a portion of the tile.
     * @param width The ideal width of the tile.
     * @param height The ideal height of the tile.
     * @param anchor The point that the tile is anchored to.
     */
    setClip(width: number, height: number, anchor: Vector3) {
        this._clipWidth = width;
        this._clipHeight = height;
        this._clipAnchor = anchor;

        this._scaleContainer.position.set(anchor.x, anchor.y, anchor.z);
        this._plane.position.set(-anchor.x, -anchor.y, -anchor.z);

        // Also update features container position to match
        this._featuresContainer.position.set(-anchor.x, -anchor.y, -anchor.z);

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

    static prepareMaterial(material: Material): Material {
        material.userData = {
            heightMap: { value: MapTile._SEA_LEVEL_TEXTURE },
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
            uniform highp float heightScale;
            uniform highp float heightOffset;
            // varying vec2 vUv;
            ` + shader.vertexShader;

            // Vertex depth logic
            shader.vertexShader = shader.vertexShader.replace(
                '#include <fog_vertex>',
                `
            #include <fog_vertex>

            // Calculate height of the title
            vec4 _theight = texture2D(heightMap, vUv);
            float _height = ((_theight.r * 256.0 * 256.0 + _theight.g * 256.0 + _theight.b) * heightScale) - (390.0 * heightScale) + heightOffset;
            vec3 _transformed = position + _height * normal;

            // Vertex position based on height
            gl_Position = projectionMatrix * modelViewMatrix * vec4(_transformed, 1.0);
            `
            );
        };

        return material;
    }

    private async _loadTexture() {
        const requestId = ++this._currentTileRequestId;
        try {
            const image: HTMLImageElement = await this._provider.fetchTile(
                this._zoom,
                this._x,
                this._y
            );

            if (requestId !== this._currentTileRequestId) {
                // A second request was made, so we don't need to use this texture.
                return;
            }

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
        } catch (error) {
            console.error(
                `Tile loading failed for zoom=${this._zoom}, x=${this._x}, y=${this._y}:`,
                error
            );
        }
    }

    private async _loadHeightTexture() {
        if (!this._usingHeightMaterial || !this.visible) {
            return;
        }
        if (this._heightProvider) {
            const requestId = ++this._currentHeightTileRequestId;
            const heightImage: HTMLImageElement =
                await this._heightProvider.fetchTile(
                    this._zoom,
                    this._x,
                    this._y
                );

            if (requestId !== this._currentHeightTileRequestId) {
                // A second request was made, so we don't need to use this texture.
                return;
            }

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
            const scale = (this._material.userData.heightScale.value =
                ZOOM_SCALES.get(this._zoom));
            this._material.userData.heightScale.value = scale;
            this._material.userData.heightOffset.value = this._heightOffset;
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
            this._material.userData.heightMap.value =
                MapTile._SEA_LEVEL_TEXTURE;
            this._plane.frustumCulled = true;
        }

        this._material.needsUpdate = true;
    }

    dispose() {
        // Clear features first
        this._clearFeatures();

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
        this._container.remove(this._featuresContainer);
        this.remove(this._scaleContainer);
        this._scaleContainer.remove(this._container);
        this._provider = null;
    }
}
