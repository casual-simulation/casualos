import { AddressType } from 'AuthStore';
import { AuthMessenger, SendCodeResult } from './AuthMessenger';

/**
 * Defines a class that defines a auth messenger which sends login request codes via console.log().
 */
export class ConsoleAuthMessenger implements AuthMessenger {
    async supportsAddressType(addressType: AddressType): Promise<boolean> {
        return true;
    }

    async sendCode(
        address: string,
        addressType: AddressType,
        code: string
    ): Promise<SendCodeResult> {
        console.log(
            `[ConsoleAuthMessenger] Code is (${addressType} -> ${address}): ${code}`
        );
        return {
            success: true,
        };
    }
}
