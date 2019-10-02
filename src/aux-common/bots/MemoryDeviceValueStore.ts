import { DeviceValueStore } from './DeviceValueStore';

export class MemoryDeviceValueStore implements DeviceValueStore {
    private _store: {
        [key: string]: any;
    } = {};

    getValue(key: string) {
        return this._store[key];
    }

    getValues(): { [key: string]: any } {
        return Object.assign({}, this._store);
    }

    setValue(key: string, value: any): void {
        this._store[key] = value;
    }
}
