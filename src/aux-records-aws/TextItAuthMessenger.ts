import {
    AuthMessenger,
    SendCodeResult,
} from '@casual-simulation/aux-records/AuthMessenger';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import axios from 'axios';

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

    supportsAddressType(addressType: AddressType): Promise<boolean> {
        return Promise.resolve(
            addressType === 'email' || addressType === 'phone'
        );
    }

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
