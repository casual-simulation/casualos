import { Atom, AtomOp, SiteInfo } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { DeviceChannelInfoRequest } from './DeviceChannelInfoRequest';
import { DeviceChannelWeaveExchangeRequest } from './DeviceChannelWeaveExchangeRequest';
/**
 * Defines an interface for an object that is able to send and receive events from a device.
 * for a channel.
 */
export interface DeviceChannelConnector {
    /**
     * An observable that resolves whenever a weave exchange request comes from the client.
     */
    onWeaveExchange: Observable<DeviceChannelWeaveExchangeRequest>;
    /**
     * An observable that resolves whenever a channel info request comes from the client.
     */
    onInfoRequest: Observable<DeviceChannelInfoRequest>;
    /**
     * An observable that resolves whenever the client sends atoms to add to the causal tree.
     */
    onAtoms: Observable<Atom<AtomOp>[]>;
    /**
     * Sends the given atoms to the client, notifying that they were added to the causal tree.
     * @param atoms The atoms to send to the client.
     */
    sendAtoms(atoms: Atom<AtomOp>[]): void;
    /**
     * Sends the given site info to the client, notifiying that it was discovered.
     * @param site The site to send.
     */
    sendSite(site: SiteInfo): void;
}
