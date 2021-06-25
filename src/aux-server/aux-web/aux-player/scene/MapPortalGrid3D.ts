import { Grid3D, GridTile } from '../../shared/scene/Grid3D';
import {
    MathUtils,
    Ray,
    Sphere,
    Vector2,
    Vector3,
} from '@casual-simulation/three';
import { MapSimulation3D } from './MapSimulation3D';
import { Input } from '../../shared/scene/Input';
import {
    calculateGridTilePoints,
    snapToTileCoord,
} from '../../shared/scene/BoundedGrid3D';
import { SpatialReference, ExternalRenderers } from '../MapUtils';

/**
 * The number of meters in a single degree of latitude.
 */
const METERS_PER_DEGREE_OF_LAT = 111000;

// See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#
const EARTH_RADIUS = 6378137;

/**
 * Defines a class that implements a 3D grid for the map portal.
 */
export class MapPortalGrid3D implements Grid3D {
    private _mapSimulation: MapSimulation3D;
    private _enabled: boolean = true;
    private _tileScale: number = 1;
    private _globe: Sphere;

    private _temp: Vector3 = new Vector3();

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    get tileScale(): number {
        return this._tileScale;
    }

    set tileScale(value: number) {
        this._tileScale = value;
    }

    get mapView() {
        return this._mapSimulation.mapView;
    }

    constructor(mapSimulation: MapSimulation3D, tileScale?: number) {
        this._mapSimulation = mapSimulation;
        this._globe = new Sphere(new Vector3(), EARTH_RADIUS);
        this._tileScale = tileScale ?? 1;
    }

    getPointFromRay(ray: Ray): Vector3 {
        const hitPoint = new Vector3();
        if (ray.intersectSphere(this._globe, hitPoint)) {
            const [x, y, z] = ExternalRenderers.fromRenderCoordinates(
                this.mapView,
                [hitPoint.x, hitPoint.y, hitPoint.z],
                0,
                [0, 0, 0],
                0,
                SpatialReference.WGS84,
                1
            );

            return new Vector3(x, 0, y);
        }

        return null;
        // Physics.raycast(ray, [this._globe], null);
        // const pagePos = this._getPagePositionForRay(ray);
        // let mapPos = this.mapView.toMap(pagePos);

        // if (mapPos) {
        //     // mapPos is in this.mapView.spatialReference
        //     // we need it in WGS84
        //     if (!mapPos.spatialReference.isWGS84) {
        //         if (!WebMercatorUtils.canProject(mapPos.spatialReference, SpatialReference.WGS84)) {
        //             return null;
        //         }
        //     }

        //     mapPos = WebMercatorUtils.project(mapPos, SpatialReference.WGS84) as Point;

        //     return new Vector3(
        //         mapPos.longitude,
        //         0,
        //         mapPos.latitude,
        //     );
        // }

        // return null;
    }

    getTileFromRay(ray: Ray, roundToWholeNumber: boolean): GridTile {
        const pos = this.getPointFromRay(ray);
        if (pos) {
            return this.getTileFromPosition(pos, roundToWholeNumber);
        }

        return null;
    }

    getGridPosition(position: { x: number; y: number; z: number }): Vector3 {
        const [x, y, z] = ExternalRenderers.fromRenderCoordinates(
            this.mapView,
            [position.x, position.y, position.z],
            0,
            [0, 0, 0],
            0,
            SpatialReference.WGS84,
            1
        );
        return new Vector3(x, y, z);
    }

    getWorldPosition(position: { x: number; y: number; z: number }): Vector3 {
        const [x, y, z] = ExternalRenderers.toRenderCoordinates(
            this.mapView,
            [position.x, position.y, position.z],
            0,
            SpatialReference.WGS84,
            [0, 0, 0],
            0,
            1
        );

        const result = new Vector3(x, y, z);

        return result;
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

        const latScale = METERS_PER_DEGREE_OF_LAT / this.tileScale;
        let tileY =
            snapToTileCoord(localPos.z * latScale, roundToWholeNumber, 1) /
            latScale;

        // 10 meter grid spaces
        // Because the earth is a sphere(ish), we need to calculate the circumference
        // at the specific latitude so that our spacing can be correct.
        // We do this calculation at the rounded latitude so that they match up when rounding
        const radiusAtLatitude =
            EARTH_RADIUS * Math.cos(MathUtils.DEG2RAD * tileY);
        const circumferenceAtLatitude = 2 * Math.PI * radiusAtLatitude;
        const metersPerDegreeOfLongitude = circumferenceAtLatitude / 360;
        const lonScale = metersPerDegreeOfLongitude / this.tileScale;

        // Snap position to a grid center.
        let tileX =
            snapToTileCoord(localPos.x * lonScale, roundToWholeNumber, 1) /
            lonScale;

        // if (
        //     tileX < this.minX ||
        //     tileX > this.maxX ||
        //     tileY < this.minY ||
        //     tileY > this.maxY
        // ) {
        //     return null;
        // }

        let tilePoints = calculateGridTilePoints(tileX, tileY, 1);

        let tile: GridTile = {
            center: tilePoints.center,
            corners: tilePoints.corners,
            tileCoordinate: new Vector2(tileX, tileY),
            grid: this,
        };

        return tile;
    }

    private _getPagePositionForRay(ray: Ray) {
        const rig = this._mapSimulation.getMainCameraRig();
        const screenPos = this._temp
            .copy(ray.origin)
            .add(ray.direction)
            .project(rig.mainCamera);
        const pagePos = Input.pagePositionForViewport(
            new Vector2(screenPos.x, screenPos.y),
            rig.viewport
        );

        return pagePos;
    }
}
