import { Socket, Server } from 'socket.io';
import {
    CausalTreeStore,
    CausalTreeFactory,
    CausalTree,
    AtomOp,
    RealtimeChannelInfo,
    storedTree,
    site,
    SiteVersionInfo,
    SiteInfo,
    Atom,
    StoredCausalTree,
    currentFormatVersion,
    atomIdToString,
    atomId,
    upgrade,
} from '@casual-simulation/causal-trees';
import { find, flatMap } from 'lodash';
import {
    bufferTime,
    flatMap as rxFlatMap,
    filter,
    concatMap,
    tap,
} from 'rxjs/operators';
import {
    PrivateCryptoKey,
    PublicCryptoKey,
    SigningCryptoImpl,
} from '@casual-simulation/crypto';
import { NodeSigningCryptoImpl } from '@casual-simulation/crypto-node';
import { AtomValidator } from '@casual-simulation/causal-trees';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    DeviceManager,
    ChannelManager,
} from '@casual-simulation/causal-tree-server';
import { DeviceManagerImpl } from '@casual-simulation/causal-tree-server/DeviceManagerImpl';
import { ChannelManagerImpl } from '@casual-simulation/causal-tree-server/ChannelManagerImpl';
import { LoadedChannel } from '@casual-simulation/causal-tree-server/ChannelManager';
import { DeviceConnection } from '@casual-simulation/causal-tree-server/DeviceConnection';

/**
 * Defines a class that is able to serve a set causal trees over Socket.io.
 *
 */
export class CausalTreeServerSocketIO {
    private _server: Server;
    private _deviceManager: DeviceManager;
    private _channelManager: ChannelManager;
    private _subs: SubscriptionLike[];

    /**
     * Creates a new causal tree factory that uses the given socket server, tree store, and tree factory.
     * @param socketServer The Socket.IO server that should be used.
     * @param treeStore The Causal Tree store that should be used.
     * @param causalTreeFactory The Causal Tree factory that should be used.
     */
    constructor(
        socketServer: Server,
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl
    ) {
        this._server = socketServer;
        this._subs = [];
        this._deviceManager = new DeviceManagerImpl();
        this._channelManager = new ChannelManagerImpl(
            treeStore,
            causalTreeFactory,
            crypto
        );

        this._init();
    }

    private _listenForEvents(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const eventName = `event_${info.id}`;
        const listener = async (refs: Atom<AtomOp>[]) => {
            const added = await this._channelManager.addAtoms(channel, refs);
            socket.to(info.id).emit(eventName, added);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _listenForInfoEvents(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const listener = async (
            event: SiteVersionInfo,
            callback: (resp: SiteVersionInfo) => void
        ) => {
            const currentInfo = await this._channelManager.updateVersionInfo(
                channel,
                event
            );
            callback(currentInfo);
        };
        const eventName = `info_${info.id}`;
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _listenForSiteIdEvents(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const eventName = `siteId_${info.id}`;
        let listener = (site: SiteInfo, callback: Function) => {
            const allowed = this._channelManager.requestSiteId(channel, site);
            if (allowed) {
                socket.to(info.id).emit(eventName, site);
            }
            callback(allowed);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _listenForWeaveEvents(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const eventName = `weave_${info.id}`;
        const listener = async (
            event: StoredCausalTree<AtomOp>,
            callback: (resp: StoredCausalTree<AtomOp>) => void
        ) => {
            const exported = await this._channelManager.exchangeWeaves(
                channel,
                event
            );
            callback(exported);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _listenForLeaveEvents(
        device: DeviceConnection<any>,
        info: RealtimeChannelInfo,
        socket: Socket,
        loaded: LoadedChannel
    ): SubscriptionLike {
        const eventName = `leave_${info.id}`;
        const listener = () => {
            socket.leave(info.id);
            this._deviceManager.leaveChannel(device, info);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _init() {
        this._subs.push(
            this._deviceManager.whenConnectedToChannel(
                async (device, channel) => {
                    let subs: SubscriptionLike[] = [];

                    const socket: Socket = device.extra.socket;

                    const loaded = await this._channelManager.loadChannel(
                        channel.info
                    );

                    subs.push(
                        loaded.subscription,
                        this._listenForEvents(channel.info, socket, loaded),
                        this._listenForInfoEvents(channel.info, socket, loaded),
                        this._listenForSiteIdEvents(
                            channel.info,
                            socket,
                            loaded
                        ),
                        this._listenForWeaveEvents(
                            channel.info,
                            socket,
                            loaded
                        ),
                        this._listenForLeaveEvents(
                            device,
                            channel.info,
                            socket,
                            loaded
                        )
                    );

                    return subs;
                }
            )
        );

        this._server.on('connection', async socket => {
            let device: DeviceConnection<any>;
            socket.on('disconnect', () => {
                if (device) {
                    this._deviceManager.disconnectDevice<any>(device);
                }
            });

            device = await this._deviceManager.connectDevice(socket.id, {
                socket: socket,
            });

            // V2 channels
            socket.on(
                'join_channel',
                (info: RealtimeChannelInfo, callback: Function) => {
                    socket.join(info.id, async err => {
                        if (err) {
                            console.log(err);
                            callback(err);
                            return;
                        }

                        await this._deviceManager.joinChannel(device, info);

                        callback(null);
                    });
                }
            );
        });
    }
}
