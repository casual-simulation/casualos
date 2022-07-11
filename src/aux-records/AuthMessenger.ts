import { AddressType } from './AuthStore';
import { ServerError } from './Errors';

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
