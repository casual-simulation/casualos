/**
 * Contains information about the device that AUX is running on.
 */
export interface AuxDevice {
    /**
     * Whether the device supports augmented reality features.
     */
    supportsAR: boolean;

    /**
     * Whether the device supports virtual reality features.
     */
    supportsVR: boolean;

    /**
     * Whether this device has enabled collaboration features.
     *
     * When creating a simulation, this property may be used to enable or disable features that facilitate users interacting with each other.
     * For example, setting isCollaborative to false would make the shared partition act like a tempLocal partition.
     */
    isCollaborative: boolean;

    /**
     * The URL that AB-1 should be bootstraped from.
     */
    ab1BootstrapUrl: string;
}
