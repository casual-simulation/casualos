/**
 * Contains information about the device that AUX is running on.
 *
 * @dochash types/os/system
 * @doctitle System Types
 * @docsidebar System
 * @docdescription Types that are used in system-related actions.
 * @docname CasualOSDevice
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
     * Whether this device can enable collaboration features after the simulation has started.
     */
    allowCollaborationUpgrade: boolean;

    /**
     * The URL that AB-1 should be bootstraped from.
     */
    ab1BootstrapUrl: string;
}
