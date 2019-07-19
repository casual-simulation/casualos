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
    LoginErrorReason,
    DeviceToken,
    Event,
} from '@casual-simulation/causal-trees';
import { find, flatMap } from 'lodash';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    DeviceManager,
    ChannelManager,
    DeviceChannelConnection,
} from '@casual-simulation/causal-tree-server';
import {
    LoadedChannel,
    DeviceConnection,
    DeviceAuthenticator,
    ChannelAuthorizer,
} from '@casual-simulation/causal-tree-server';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { scan } from 'rxjs/operators';

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
    private _channelSiteMap: Map<string, Map<number, Socket>>;

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
        this._channelSiteMap = new Map();

        this._init();
    }

    private _listenForEvents(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const eventName = `event_${info.id}`;
        const listener = async (refs: Atom<AtomOp>[]) => {
            await this._channelManager.addAtoms(channel, refs);
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
            callback: (err: any, resp: SiteVersionInfo) => void
        ) => {
            const currentInfo = await this._channelManager.updateVersionInfo(
                channel,
                event
            );
            callback(null, currentInfo);
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
        channel: LoadedChannel,
        siteMap: Map<number, Socket>
    ): SubscriptionLike {
        const eventName = `siteId_${info.id}`;
        let grantedSiteId: number = null;
        let listener = async (
            site: SiteInfo,
            callback: (err: any, allowed: boolean) => void
        ) => {
            const allowed = await this._channelManager.requestSiteId(
                channel,
                site
            );
            if (allowed) {
                grantedSiteId = site.id;
                siteMap.set(site.id, socket);
                socket.to(info.id).emit(eventName, site);
            }
            callback(null, allowed);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
            if (grantedSiteId) {
                siteMap.delete(grantedSiteId);
            }
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
            callback: (err: any, resp: StoredCausalTree<AtomOp>) => void
        ) => {
            const exported = await this._channelManager.exchangeWeaves(
                channel,
                event
            );
            callback(null, exported);
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

    private _listenForRemoteEvents(
        device: DeviceInfo,
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel
    ): SubscriptionLike {
        const eventName = `remote_event_${info.id}`;
        const listener = async (events: Event[]) => {
            await this._channelManager.sendEvents(device, channel, events);
        };
        socket.on(eventName, listener);

        return new Subscription(() => {
            socket.off(eventName, listener);
        });
    }

    private _setupListeners(
        socket: Socket,
        device: DeviceConnection<DeviceInfo>,
        channel: DeviceChannelConnection,
        loaded: LoadedChannel
    ): SubscriptionLike[] {
        let siteMap = this._channelSiteMap.get(channel.info.id);
        if (!siteMap) {
            siteMap = new Map();
            this._channelSiteMap.set(channel.info.id, siteMap);
        }

        return [
            this._listenForEvents(channel.info, socket, loaded),
            this._listenForInfoEvents(channel.info, socket, loaded),
            this._listenForSiteIdEvents(channel.info, socket, loaded, siteMap),
            this._listenForWeaveEvents(channel.info, socket, loaded),
            this._listenForLeaveEvents(device, channel.info, socket, loaded),
            this._listenForRemoteEvents(
                device.extra,
                channel.info,
                socket,
                loaded
            ),

            loaded.tree.atomAdded.subscribe(atoms => {
                if (atoms.length > 0) {
                    let site = atoms[0].id.site;
                    let siteSocket = siteMap.get(site);
                    if (siteSocket) {
                        siteSocket
                            .to(channel.info.id)
                            .emit(`event_${channel.info.id}`, atoms);
                    } else {
                        socket.broadcast
                            .to(channel.info.id)
                            .emit(`event_${channel.info.id}`, atoms);
                    }
                }
            }),
        ];
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
                        ...this._setupListeners(socket, device, channel, loaded)
                    );

                    return subs;
                }
            )
        );

        this._server.on('connection', async socket => {
            let device: DeviceConnection<DeviceInfo>;
            let info: DeviceInfo;
            socket.on('disconnect', () => {
                if (device) {
                    this._deviceManager.disconnectDevice<any>(device);
                }
            });

            socket.on(
                'login',
                async (
                    token: DeviceToken,
                    callback: (err: any, info: DeviceInfo) => void
                ) => {
                    console.log(
                        `[CasualTreeServerSocketIO] Logging ${
                            token.username
                        } in...`
                    );
                    if (device) {
                        console.log(
                            `[CasualTreeServerSocketIO] ${
                                token.username
                            } already logged in.`
                        );
                        callback(null, info);
                        return;
                    }

                    this._authenticator
                        .authenticate(token)
                        .subscribe(async result => {
                            if (!result.success) {
                                console.log(
                                    `[CasualTreeServerSocketIO] ${
                                        token.username
                                    } not authenticated.`
                                );
                                callback(
                                    {
                                        error: result.error,
                                        message: 'Unable to authenticate',
                                    },
                                    null
                                );
                                return;
                            }

                            info = result.info;

                            console.log(
                                `[CasualTreeServerSocketIO] ${
                                    token.username
                                } logged in!`
                            );

                            if (device) {
                                this._deviceManager.disconnectDevice(device);
                            }

                            device = await this._deviceManager.connectDevice(
                                socket.id,
                                {
                                    ...result.info,
                                    socket: socket,
                                }
                            );

                            // V2 channels
                            socket.on(
                                'join_channel',
                                (
                                    info: RealtimeChannelInfo,
                                    callback: (err: LoginErrorReason) => void
                                ) => {
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
                                            callback('unauthorized');
                                            return;
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

                            callback(null, info);
                        });
                }
            );
        });
    }
}
