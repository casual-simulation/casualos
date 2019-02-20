import { RealtimeChannelInfo } from "./RealtimeChannelInfo";
import { CausalTree } from "./CausalTree";
import { Observable, SubscriptionLike } from "rxjs";
import { RealtimeChannelConnection } from "./RealtimeChannelConnection";
import { SiteVersionInfo } from "./SiteVersionInfo";
import { filter, map, tap, first } from "rxjs/operators";
import { ConnectionEvent } from "./ConnectionEvent";

/**
 * Defines a class for a realtime event channel.
 * That is, a persistent connection between two devices.
 * 
 * Upon connecting, the channel can ask the other device questions about its state
 * and get a response.
 * In addition, the channel can send arbitrary events to the other device.
 */
export class RealtimeChannel<TEvent> implements SubscriptionLike {

    private _connection: RealtimeChannelConnection;
    private _emitName: string;
    private _infoName: string;

    /**
     * Creates a new realtime channel.
     * @param info 
     * @param connection 
     */
    constructor(info: RealtimeChannelInfo, connection: RealtimeChannelConnection) {
        this.info = info;
        this._connection = connection;
        this._emitName = `event_${info.id}`;
        this._infoName = `info_${info.id}`;
        this._connection.init([
            this._emitName,
            this._infoName
        ]);

        this.events = this._connection.events.pipe(
            filter(e => e.name === this._emitName),
            map(e => e.data)
        );

        this.connectionStateChanged.pipe(
            filter(connected => connected),
            tap(connected => {
                this._connection.emit({
                    name: 'join_channel',
                    data: this.info
                });
            })
        ).subscribe();
    }

    /**
     * The info about the channel.
     */
    info: RealtimeChannelInfo;

    /**
     * The events from the remote peer.
     */
    events: Observable<TEvent>;

    /**
     * Whether this channel has been disposed.
     */
    get closed() {
        return this._connection.closed;
    }

    /**
     * Exchanges version information with the remote peer.
     * Returns a promise that resolves with the remote's version info.
     * @param version The local information.
     */
    exchangeInfo(version: SiteVersionInfo): Promise<SiteVersionInfo> {
        return this._connection.request(this._infoName, version);
    }

    /**
     * Emits the given event to the remote peer.
     * While disconnected, this function does nothing.
     * @param event The event.
     */
    emit(event: TEvent) {
        this._connection.emit({
            name: this._emitName, 
            data: event
        });
    }

    /**
     * Gets whether this channel is currently connected to the remote.
     */
    get isConnected() {
        return this._connection.isConnected();
    }

    /**
     * An observable that resolves whenever the state between this client
     * and the remote peer changes. Upon subscription, this observable
     * will resolve immediately with the current connection state.
     * 
     * Basically this resolves with true whenever we're connected and false whenever we're disconnected.
     */
    get connectionStateChanged() {
        return this._connection.connectionStateChanged;
    }

    /**
     * Disposes of this channel.
     */
    unsubscribe(): void {
        this._connection.unsubscribe();
    }
}

