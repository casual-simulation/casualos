import { Grid3D, GridTile } from '../../shared/scene/Grid3D';
import {
    Color,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    MathUtils,
    Object3D,
    Quaternion,
    Ray,
    Sphere,
    SphereBufferGeometry,
    Vector2,
    Vector3,
} from '@casual-simulation/three';
import { Input } from '../../shared/scene/Input';
import {
    calculateGridTilePoints,
    snapToTileCoord,
} from '../../shared/scene/BoundedGrid3D';
import { latLonToCartesian, cartesianToLatLon } from './CoordinateSystem';
import { disposeObject3D } from './SceneUtils';

/**
 * The number of meters in a single degree of latitude.
 */
const METERS_PER_DEGREE_OF_LAT = 111000;

// See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#
export const EARTH_RADIUS = 6378137;

/**
 * Defines a class that implements a 3D grid for the map portal.
 */
export class SphereGrid3D extends Object3D implements Grid3D {
    private _enabled: boolean = true;
    private _tileScale: number = 1;
    private _showGrid: boolean;

    private _gridLines: LineSegments;
    private _useLatLon: boolean;

    get enabled() {
        return this._enabled;
    }

    set enabled(value: boolean) {
        if (value === this._enabled) {
            return;
        }
        this._enabled = value;
        if (this._gridLines) {
            this._gridLines.visible = this._enabled && this._showGrid;
        }
    }

    get useLatLon() {
        return this._useLatLon;
    }

    set useLatLon(value: boolean) {
        this._useLatLon = value;
    }

    get tileScale(): number {
        return this._tileScale;
    }

    set tileScale(value: number) {
        this._tileScale = value;
    }

    get sphere(): Sphere {
        return new Sphere(new Vector3(0, 0, 0), this._radius);
    }

    private get _radius() {
        const worldScale = this.getWorldScale(new Vector3());
        return worldScale.x / 2;
    }

    constructor(tileScale?: number, useLatLon?: boolean) {
        super();
        this._useLatLon = useLatLon;
        this._tileScale = tileScale ?? 1;
    }

    getPointFromRay(ray: Ray): Vector3 {
        const r = this._getLocalRay(ray);
        const hitPoint = new Vector3();
        if (r.intersectSphere(this.sphere, hitPoint)) {
            if (this._useLatLon) {
                let res = cartesianToLatLon(this._radius, hitPoint);
                return new Vector3(res.y, res.x, res.z);
            }

            return hitPoint.divideScalar(this.tileScale);
        }

        return null;
    }

    private _getLocalRay(ray: Ray): Ray {
        const origin = ray.origin.clone();
        const worldPosition = this.getWorldPosition(new Vector3());

        origin.sub(worldPosition);

        const direction = ray.direction.clone();
        const worldRotation = this.getWorldQuaternion(new Quaternion());

        worldRotation.invert();
        direction.applyQuaternion(worldRotation);
        origin.applyQuaternion(worldRotation);

        return new Ray(origin, direction);
    }

    getTileFromRay(ray: Ray, roundToWholeNumber: boolean): GridTile {
        const pos = this.getPointFromRay(ray);
        if (pos) {
            return this.getTileFromPosition(pos, roundToWholeNumber);
        }

        return null;
    }

    getGridPosition(position: { x: number; y: number; z: number }): Vector3 {
        if (this._useLatLon) {
            return cartesianToLatLon(
                this._radius,
                new Vector3(position.x, position.y, position.z)
            );
        } else {
            return new Vector3(position.x, position.y, position.z);
        }
    }

    getGridWorldPosition(position: {
        x: number;
        y: number;
        z: number;
    }): Vector3 {
        if (this._useLatLon) {
            return latLonToCartesian(
                this._radius,
                new Vector3(position.x, position.y, position.z)
            );
        } else {
            return new Vector3(position.x, position.y, position.z);
        }
    }

    /**
     * Retrive the grid tile that contains the given position.
     * @param position The world space position.
     */
    getTileFromPosition(
        position: Vector3,
        roundToWholeNumber: boolean
    ): GridTile {
        const localPos = position.clone();

        // TODO: Support snapping to grid
        let tileY = localPos.y;
        let tileX = localPos.x;

        let tilePoints = calculateGridTilePoints(tileX, tileY, 1);

        let tile: GridTile = {
            center: tilePoints.center,
            corners: tilePoints.corners,
            tileCoordinate: new Vector2(tileX, tileY),
            grid: this,
            is3DTile: !this.useLatLon,
        };

        if (!this.useLatLon) {
            tile.center = position.clone();
        }

        return tile;
    }

    showGrid(show: boolean, recreate: boolean = false): SphereGrid3D {
        if (show === undefined || show === null) {
            return;
        }
        this._showGrid = show;

        if (this._gridLines) {
            this._gridLines.visible = show && this._enabled;
        }

        if (!this._gridLines || recreate) {
            if (show) {
                // Create the grid lines.
                this._createGridLines();
            }
        }

        return this;
    }

    private _createGridLines() {
        if (this._gridLines) {
            this.remove(this._gridLines);
            disposeObject3D(this._gridLines);
        }

        const sphereGeo = new SphereBufferGeometry(0.5, 24, 24);
        const material = new LineBasicMaterial({
            transparent: true,
            color: new Color('#fff'),
            opacity: 0.25,
        });

        const wireframe = new EdgesGeometry(sphereGeo);
        this._gridLines = new LineSegments(wireframe, material);
        this._gridLines.visible = this._showGrid && this._enabled;
        this._gridLines.quaternion.setFromAxisAngle(
            new Vector3(1, 0, 0),
            Math.PI / 2
        );
        this.add(this._gridLines);
    }
}
