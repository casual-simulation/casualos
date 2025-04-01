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
import type {
    AuthMessenger,
    SendCodeResult,
} from '@casual-simulation/aux-records/AuthMessenger';
import type { AddressType } from '@casual-simulation/aux-records/AuthStore';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import axios from 'axios';

const TRACE_NAME = 'TextItAuthMessenger';

/**
 * Defines a class that implements an AuthMessenger for TextIt.
 */
export class TextItAuthMessenger implements AuthMessenger {
    private _apiKey: string;
    private _flowId: string;

    constructor(apiKey: string, flowId: string) {
        this._apiKey = apiKey;
        this._flowId = flowId;
    }

    @traced(TRACE_NAME)
    supportsAddressType(addressType: AddressType): Promise<boolean> {
        return Promise.resolve(
            addressType === 'email' || addressType === 'phone'
        );
    }

    @traced(TRACE_NAME)
    async sendCode(
        address: string,
        addressType: AddressType,
        code: string
    ): Promise<SendCodeResult> {
        if (addressType !== 'email' && addressType !== 'phone') {
            return {
                success: false,
                errorCode: 'address_type_not_supported',
                errorMessage: `${addressType} addresses are not supported`,
            };
        }

        try {
            const result = await axios.post(
                'https://textit.com/api/v2/flow_starts.json',
                {
                    flow: this._flowId,
                    urns: [
                        addressType === 'email'
                            ? `mailto:${address}`
                            : `tel:${address}`,
                    ],
                    params: {
                        code: code,
                    },
                    restart_participants: true,
                },
                {
                    headers: {
                        Authorization: `Token ${this._apiKey}`,
                    },
                }
            );

            return {
                success: true,
            };
        } catch (err) {
            if (err.response) {
                if (err.response.status === 400) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_address',
                        errorMessage: 'The given address is invalid.',
                    };
                }
            }
            console.error('[TextItAuthMessenger] A server error ocurred:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}
