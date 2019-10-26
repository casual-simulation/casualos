import { Observable, SubscriptionLike } from 'rxjs';
import { RealtimeChannelInfo } from './RealtimeChannelInfo';
import { RealtimeChannelResult } from './RealtimeChannelResult';
import { Atom, AtomOp } from './Atom';
import { SiteVersionInfo } from './SiteVersionInfo';
import { SiteInfo } from './SiteIdInfo';
import { StoredCausalTree } from './StoredCausalTree';
import { DeviceInfo } from './DeviceInfo';
import { DeviceToken } from './User';
import { Action, DeviceAction } from './Event';

/**
 * Defines an interface for a realtime channel connection.
 * That is, objects that are able to manage a connection with a remote peer.
 *
 * From an implementation perspective, this is basically a simple abstract wrapper around Socket IO.
 */
export interface RealtimeChannelConnection extends SubscriptionLike {
    /**
     * Gets the info about the channel that this connection is for.
     */
    info: RealtimeChannelInfo;

    /**
     * Initializes the channel connection.
     */
    connect(): void;

    /**
     * Determines whether this connection is currently connected to the remote peer.
     */
    isConnected(): boolean;

    /**
     * The observable list of atoms on this connection from the remote peer.
     */
    atoms: Observable<Atom<AtomOp>[]>;

    /**
     * The observable list of events on this connection from a remote peer.
     */
    events: Observable<DeviceAction[]>;

    /**
     * The observable list of sites that have been added.
     */
    sites: Observable<SiteInfo>;

    /**
     * The observable list of connection states.
     * Resolves with true when connected and false when disconnected.
     * Upon subscription, the observable resolves with the current connection state.
     */
    connectionStateChanged: Observable<boolean>;

    /**
     * Attempts to login with the given user.
     */
    login(user: DeviceToken): Observable<RealtimeChannelResult<DeviceInfo>>;

    /**
     * Attempts to join the channel.
     */
    joinChannel(): Observable<RealtimeChannelResult<void>>;

    /**
     * Emits the given atoms to the joined channels.
     * @param atoms The atoms to emit.
     */
    emit(atoms: Atom<AtomOp>[]): Promise<RealtimeChannelResult<void>>;

    /**
     * Sends the given events to the server.
     */
    sendEvents(events: Action[]): Promise<void>;

    /**
     * Exchanges version information with the remote peer.
     * Returns a promise that resolves with the remote's version info.
     * @param version The local information.
     */
    exchangeInfo(
        version: SiteVersionInfo
    ): Promise<RealtimeChannelResult<SiteVersionInfo>>;

    /**
     * Requests the given site ID from the remote peer.
     * This can act as a way to solve race conditions when two peers
     * try to become the same site at the same time.
     *
     * Returns true if the given site info was granted to this peer.
     * Otherwise returns false.
     * @param site The site info that this channel is trying to use.
     */
    requestSiteId(site: SiteInfo): Promise<RealtimeChannelResult<boolean>>;

    /**
     * Sends the given weave to the remote peer and requests
     * a weave from the remote peer.
     * If null is given as the current version then the remote peer will return
     * its entire weave.
     * TODO: If a version is provided then the remote peer will return a partial weave containing
     * the full history of any missing atoms.
     * @param weave The weave to send to the remote server.
     * @param currentVersion The local weave version.
     */
    exchangeWeaves<T extends AtomOp>(
        message: StoredCausalTree<T>
    ): Promise<RealtimeChannelResult<StoredCausalTree<T>>>;
}
