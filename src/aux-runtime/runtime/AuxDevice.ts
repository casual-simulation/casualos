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
     * Whether the device supports full Document Object Model features.
     * See https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model for more info.
     */
    supportsDOM: boolean;

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

    /**
     * The comID that this inst was loaded from.
     *
     * Null if it was not loaded from a comID.
     */
    comID: string | null;
}
