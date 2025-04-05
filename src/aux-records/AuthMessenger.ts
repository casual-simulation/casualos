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
import type { AddressType } from './AuthStore';
import type { ServerError } from '@casual-simulation/aux-common/Errors';

/**
 * Defines an interface for a service that is able to send messages to addresses for login requests.
 */
export interface AuthMessenger {
    /**
     * Determines if the given address type is supported by this messenger.
     * @param addressType The type of address.
     */
    supportsAddressType(addressType: AddressType): Promise<boolean>;

    /**
     * Attempts to send the given code to the given address.
     * @param address The address that the code should be sent to.
     * @param addressType The type of the address.
     * @param code The code that should be sent.
     */
    sendCode(
        address: string,
        addressType: AddressType,
        code: string
    ): Promise<SendCodeResult>;
}

export type SendCodeResult = SendCodeSuccess | SendCodeFailure;

export interface SendCodeSuccess {
    success: true;
}

export interface SendCodeFailure {
    success: false;
    errorCode:
        | 'unacceptable_address'
        | 'address_type_not_supported'
        | ServerError;
    errorMessage: string;
}
