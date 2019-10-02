/**
 * Defines a simple key/value store that can be used store and retrieve values stored directly on someone's device.
 */
export interface DeviceValueStore {
    /**
     * Gets the value stored for the given key.
     * @param key The key to retrieve.
     */
    getValue(key: string): any;

    /**
     * Gets all the values that are stored.
     */
    getValues(): {
        [key: string]: any;
    };

    /**
     * Sets the value stored for the given key.
     * @param key The key.
     * @param value The value to store.
     */
    setValue(key: string, value: any): void;
}
