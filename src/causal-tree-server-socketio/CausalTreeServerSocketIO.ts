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
import {
    LoadedChannel,
    DeviceConnection,
    DeviceAuthenticator,
    ChannelAuthorizer,
    DeviceInfo,
    DeviceToken,
} from '@casual-simulation/causal-tree-server';

/**
 * Defines a class that is able to serve a set causal trees over Socket.io.
 *
 */
export class CausalTreeServerSocketIO {
    private _server: Server;
    private _deviceManager: DeviceManager;
    private _channelManager: ChannelManager;
    private _authenticator: DeviceAuthenticator;
    private _authorizer: ChannelAuthorizer;
    private _subs: SubscriptionLike[];

    /**
     * Creates a new causal tree factory that uses the given socket server, and channel manager.
     * @param socketServer The Socket.IO server that should be used.
     * @param channelManager The channel manager that should be used.
     */
    constructor(
        socketServer: Server,
        deviceManager: DeviceManager,
        channelManager: ChannelManager,
        authenticator: DeviceAuthenticator,
        authorizer: ChannelAuthorizer
    ) {
        this._server = socketServer;
        this._subs = [];
        this._deviceManager = deviceManager;
        this._authenticator = authenticator;
        this._authorizer = authorizer;
        this._channelManager = channelManager;

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
            let device: DeviceConnection<DeviceInfo>;
            socket.on('disconnect', () => {
                if (device) {
                    this._deviceManager.disconnectDevice<any>(device);
                }
            });

            this._server.on(
                'login',
                async (
                    token: DeviceToken,
                    callback: (error?: string) => void
                ) => {
                    if (device) {
                        callback('Already authenticated');
                    }

                    const info = await this._authenticator.authenticate(token);

                    if (!info) {
                        callback('Unable to authenticate');
                    }

                    device = await this._deviceManager.connectDevice(
                        socket.id,
                        {
                            ...info,
                            socket: socket,
                        }
                    );

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

                                const loaded = await this._channelManager.loadChannel(
                                    info
                                );
                                const authorized = this._authorizer.isAllowedAccess(
                                    device.extra,
                                    loaded
                                );

                                if (!authorized) {
                                    console.log(
                                        '[CausalTreeServerSocketIO] Not authorized:' +
                                            info.id
                                    );
                                    loaded.subscription.unsubscribe();
                                    callback('Not allowed access to channel');
                                }

                                await this._deviceManager.joinChannel(
                                    device,
                                    info
                                );

                                loaded.subscription.unsubscribe();
                                callback(null);
                            });
                        }
                    );

                    callback();
                }
            );
        });
    }
}
