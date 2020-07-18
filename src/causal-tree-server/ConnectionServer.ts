import { Observable } from 'rxjs';
import {
    DeviceInfo,
    DisconnectionReason,
} from '@casual-simulation/causal-trees';

/**
 * Defines a connection server.
 * That is, a service which provides an observable list of connections.
 */
export interface ConnectionServer {
    /**
     * The observable list of connections.
     */
    connection: Observable<Connection>;
}

/**
 * Defines a connection to a device.
 */
export interface Connection {
    /**
     * The device this connection is for.
     */
    device: DeviceInfo;

    /**
     * Gets an observable for events sent from the device with the given name.
     * @param event The name of the event.
     */
    event<T>(event: string): Observable<T>;

    /**
     * Gets an observable that is triggered when
     * the device is disconnected.
     */
    disconnect: Observable<DisconnectionReason>;

    /**
     * Sends an event to the device.
     * @param name The name of the event.
     * @param data The data in the event.
     */
    send(name: string, data: any): void;
}
