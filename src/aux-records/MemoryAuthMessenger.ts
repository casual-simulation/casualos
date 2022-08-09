import { AddressType } from './AuthStore';
import { AuthMessenger, SendCodeResult } from './AuthMessenger';

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
