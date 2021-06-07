/**
 * Defines the possible coordinate systems.
 */
export enum CoordinateSystem {
    /**
     * Specifies that the coordinate system uses Z for the up axis.
     * This is what AUX uses.
     */
    Z_UP,

    /**
     * Specifies that the coordinate system uses Y for the up axis.
     * This is what the Three.js scenes use by default.
     */
    Y_UP,
}
