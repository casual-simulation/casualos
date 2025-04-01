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

export interface GenericError {
    /**
     * The error code.
     */
    errorCode: string;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines a class that represents a generic CasualOS error.
 *
 * @dochash types/error
 * @doctitle Error Types
 * @docsidebar Error
 * @docdescription Types that contain information about errors that can occur in CasualOS.
 * @docname CasualOSError
 */
export class CasualOSError extends Error {
    /**
     * The error code that occurred.
     */
    errorCode: string;

    /**
     * The error message that occurred.
     */
    errorMessage: string;

    constructor(error: GenericError | string) {
        super(
            typeof error === 'string'
                ? error
                : `${error.errorCode}: ${error.errorMessage}`
        );
        if (typeof error === 'string') {
            this.errorCode = 'error';
            this.errorMessage = error;
        } else {
            this.errorCode = error.errorCode;
            this.errorMessage = error.errorMessage;
        }
    }
}
