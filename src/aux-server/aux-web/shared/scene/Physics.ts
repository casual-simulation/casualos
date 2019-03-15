import { Vector2, Camera, Vector3, Ray, Raycaster, Object3D, Intersection, Mesh, Plane } from "three";

/**
 * Container for all custom physics functions for game engine.
 */
export namespace Physics {

    /**
    * Defines the result of a raycast.
    */
    export interface RaycastResult {
        /**
         * The screen position used to perform this raycast.
         */
        pointerScreenPos: Vector2;

        /**
         * The list of intersections from the raycast.
         */
        intersects: Intersection[];
    }

    /**
     * Calculates a ray from the given screen position and camera.
     * @pos The screen position that the ray should use for its direction vector.
     * @camera The camera that the ray should point from.
     */
    export function screenPosToRay(pos: Vector2, camera: Camera) {
        const v3d = new Vector3(pos.x, pos.y, 0.5);

        v3d.unproject(camera);

        v3d.sub(camera.position);
        v3d.normalize();

        return new Ray(camera.position, v3d);
    }

    /**
     * Gets a point that is the given distance along the given ray.
     * @param ray The ray.
     * @param distance The distance along the ray from the origin.
     */
    export function pointOnRay(ray: Ray, distance: number): Vector3 {
        let pos = new Vector3(ray.direction.x, ray.direction.y, ray.direction.z);
        pos.multiplyScalar(distance);
        pos.add(ray.origin);

        return pos;
    }

    /**
     * Calculates the point at which the given ray intersects the given plane.
     * If the ray does not intersect the plane then null is returned.
     * @param ray The ray.
     * @param plane The plane that the ray should test against.
     */
    export function pointOnPlane(ray: Ray, plane: Plane): Vector3 | null {
        let point = new Vector3();
        point = ray.intersectPlane(plane, point);

        return point;
    }

    /**
     * Performs a raycast at the given screen position with the given camera using the given raycaster and against the given objects.
     * @param pos The screen position to raycast from.
     * @param raycaster The raycaster to use.
     * @param objects The objects to raycast against.
     * @param camera The camera to use.
     */
    export function raycastAtScreenPos(pos: Vector2, raycaster: Raycaster, objects: Object3D[], camera: Camera): RaycastResult {
        raycaster.setFromCamera(pos, camera);
        const intersects = raycaster.intersectObjects(objects, true);

        return {
            pointerScreenPos: pos,
            intersects
        };
    }

    /**
     * Returns the first intersection from the raycast test. If none exist, then null is returned.
     */
    export function firstRaycastHit(result: RaycastResult) {
        return result.intersects.length > 0 ? result.intersects[0] : null;
    }
}