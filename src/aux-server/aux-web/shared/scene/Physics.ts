import {
    Vector2,
    Camera,
    Vector3,
    Ray,
    Raycaster,
    Object3D,
    Intersection,
    Mesh,
    Plane,
} from 'three';

/**
 * Container for all custom physics functions for game engine.
 */
export namespace Physics {
    /**
     * Infinite mathematical plane whos normal points up towards the sky.
     */
    export const GroundPlane: Plane = new Plane(new Vector3(0, 1, 0));

    /**
     * Defines the result of a raycast.
     */
    export interface RaycastResult {
        /**
         * The screen position used to perform this raycast.
         */
        pointerScreenPos: Vector2;

        /**
         * The ray used to perform this raycast.
         */
        ray: Ray;

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
    export function screenPosToRay(screenPos: Vector2, camera: Camera): Ray {
        let raycaster = new Raycaster();
        raycaster.setFromCamera(screenPos, camera);
        return raycaster.ray;
    }

    /**
     * Gets a point that is the given distance along the given ray.
     * @param ray The ray.
     * @param distance The distance along the ray from the origin.
     */
    export function pointOnRay(ray: Ray, distance: number): Vector3 {
        let pos = new Vector3(
            ray.direction.x,
            ray.direction.y,
            ray.direction.z
        );
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
     * @param screenPos The screen position to raycast from.
     * @param objects The objects to raycast against.
     * @param camera The camera to use.
     */
    export function raycastAtScreenPos(
        screenPos: Vector2,
        objects: Object3D[],
        camera: Camera
    ): RaycastResult {
        const raycaster = new Raycaster();
        raycaster.setFromCamera(screenPos, camera);
        const intersects = raycaster.intersectObjects(objects, true);

        return {
            pointerScreenPos: screenPos,
            ray: raycaster.ray.clone(),
            intersects,
        };
    }

    /**
     * Performs a raycast with the given ray against the given objects.
     * @param ray The ray to use.
     * @param objects The objects to raycast against.
     * @param camera The camera to use when testing against billboarded objects like sprites.
     */
    export function raycast(
        ray: Ray,
        objects: Object3D[],
        camera: Camera
    ): RaycastResult {
        const raycaster = new Raycaster(ray.origin, ray.direction);
        raycaster.camera = camera;
        const intersects = raycaster.intersectObjects(objects, true);

        return {
            pointerScreenPos: null,
            ray: raycaster.ray.clone(),
            intersects,
        };
    }

    /**
     * Returns the first intersection from the raycast test. If none exist, then null is returned.
     * @param result The raycast result.
     * @param hitFilter The filter that should be used for intersections. Should return true for the hit that should be returned.
     */
    export function firstRaycastHit(
        result: RaycastResult,
        hitFilter: (hit: Intersection) => boolean = null
    ) {
        if (hitFilter) {
            return result.intersects.find(i => hitFilter(i)) || null;
        }
        return result.intersects.length > 0 ? result.intersects[0] : null;
    }
}
