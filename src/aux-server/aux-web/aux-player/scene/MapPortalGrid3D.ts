import { Grid3D, GridTile } from '../../shared/scene/Grid3D';
import { Ray, Sphere, Vector2, Vector3 } from '@casual-simulation/three';
import { MapSimulation3D } from './MapSimulation3D';
import { Input } from '../../shared/scene/Input';
import {
    calculateGridTilePoints,
    snapToTileCoord,
} from '../../shared/scene/BoundedGrid3D';
import { SpatialReference, ExternalRenderers } from '../MapUtils';

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

    constructor(mapSimulation: MapSimulation3D) {
        this._mapSimulation = mapSimulation;

        // See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#
        this._globe = new Sphere(new Vector3(), 6378137);
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

    getTileFromRay(ray: Ray, roundToWholeNumber?: boolean): GridTile {
        const pos = this.getPointFromRay(ray);
        if (pos) {
            return this.getTileFromPosition(pos, roundToWholeNumber);
        }

        return null;
    }

    getGridPosition(position: { x: number; y: number; z: number }): Vector3 {
        const result = new Vector3(
            position.x,
            position.y,
            position.z
        ).divideScalar(this.tileScale);
        return new Vector3(result.x, -result.z, result.y);
    }

    getWorldPosition(position: { x: number; y: number; z: number }): Vector3 {
        const result = new Vector3(
            position.x,
            position.z,
            -position.y
        ).multiplyScalar(this.tileScale);
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

        // Snap position to a grid center.
        let tileX = snapToTileCoord(
            localPos.x,
            roundToWholeNumber,
            this.tileScale
        );
        let tileY = snapToTileCoord(
            localPos.z,
            roundToWholeNumber,
            this.tileScale
        );

        // if (
        //     tileX < this.minX ||
        //     tileX > this.maxX ||
        //     tileY < this.minY ||
        //     tileY > this.maxY
        // ) {
        //     return null;
        // }

        let tilePoints = calculateGridTilePoints(tileX, tileY, this.tileScale);

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
