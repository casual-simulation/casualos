import type { AddressType } from './AuthStore';
import type { AuthMessenger, SendCodeResult } from './AuthMessenger';
import { injectable } from 'inversify';

@injectable()
export class MemoryAuthMessenger implements AuthMessenger {
    private _messages: {
        address: string;
        addressType: AddressType;
        code: string;
    }[] = [];

    get messages() {
        return this._messages;
    }

    async supportsAddressType(addressType: AddressType): Promise<boolean> {
        return true;
    }

    async sendCode(
        address: string,
        addressType: AddressType,
        code: string
    ): Promise<SendCodeResult> {
        this._messages.push({
            address,
            addressType,
            code,
        });

        return {
            success: true,
        };
    }
}
