import type { AddressType } from './AuthStore';
import type { AuthMessenger, SendCodeResult } from './AuthMessenger';
import { injectable } from 'inversify';

/**
 * Defines a class that defines a auth messenger which sends login request codes via console.log().
 */
@injectable()
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
