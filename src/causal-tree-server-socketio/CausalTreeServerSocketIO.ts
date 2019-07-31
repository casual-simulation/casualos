import { Socket, Server } from 'socket.io';
import {
    AtomOp,
    RealtimeChannelInfo,
    SiteVersionInfo,
    SiteInfo,
    Atom,
    StoredCausalTree,
    DeviceToken,
    Event,
    RemoteEvent,
} from '@casual-simulation/causal-trees';
import {
    Observable,
    Observer,
    SubscriptionLike,
    Subscription,
    empty,
} from 'rxjs';
import {
    DeviceManager,
    ChannelManager,
    DeviceChannelConnection,
    loadChannel,
    connectDeviceChannel,
} from '@casual-simulation/causal-tree-server';
import {
    LoadedChannel,
    DeviceConnection,
    DeviceAuthenticator,
    ChannelAuthorizer,
} from '@casual-simulation/causal-tree-server';
import { DeviceInfo } from '@casual-simulation/causal-trees';
import { switchMap, mergeMap, tap, concatMap } from 'rxjs/operators';
import { socketEvent } from './Utils';

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

    private _listenForAtoms(
        info: RealtimeChannelInfo,
        socket: Socket,
        channel: LoadedChannel,
        siteMap: Map<number, Socket>
    ): SubscriptionLike {
        const eventName = `event_${info.id}`;
        const listener = async (refs: Atom<AtomOp>[]) => {
            if (refs.length > 0) {
                let site = refs[0].id.site;
                siteMap.set(site, socket);
            }
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
        const listener = async (events: RemoteEvent[]) => {
            // TODO: Figure out where to pipe these events
            let unwrapped = events.map(e => e.event);
            await this._channelManager.sendEvents(device, channel, unwrapped);
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
            this._listenForAtoms(channel.info, socket, loaded, siteMap),
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
        ];
    }

    private _init() {
        this._subs.push(
            this._channelManager.whileCausalTreeLoaded((tree, info) => {
                let siteMap = this._channelSiteMap.get(info.id);
                if (!siteMap) {
                    siteMap = new Map();
                    this._channelSiteMap.set(info.id, siteMap);
                }

                return [
                    tree.atomAdded.subscribe(atoms => {
                        if (atoms.length > 0) {
                            let site = atoms[0].id.site;
                            let siteSocket = siteMap.get(site);
                            if (siteSocket) {
                                siteSocket
                                    .to(info.id)
                                    .emit(`event_${info.id}`, atoms);
                            } else {
                                this._server
                                    .to(info.id)
                                    .emit(`event_${info.id}`, atoms);
                            }
                        }
                    }),
                ];
            }),
            this._deviceManager.whenConnectedToChannel(
                async (device, channel) => {
                    let subs: SubscriptionLike[] = [];

                    const socket: Socket = device.extra.socket;

                    const loaded = await this._channelManager.loadChannel(
                        channel.info
                    );

                    subs.push(
                        loaded.subscription,
                        await this._channelManager.connect(
                            loaded,
                            device.extra
                        ),
                        ...this._setupListeners(socket, device, channel, loaded)
                    );

                    return subs;
                }
            )
        );

        this._server.on('connection', async socket => {
            const loginEvents = socketEvent(
                socket,
                'login',
                (token: DeviceToken) => ({ token } as const)
            );

            const loginFlow = loginEvents.pipe(
                tap(({ token }) => {
                    console.log(
                        `[CasualTreeServerSocketIO] Logging ${
                            token.username
                        } in...`
                    );
                }),
                switchMap(
                    ({ token }) => this._authenticator.authenticate(token),
                    (data, result) => ({ ...data, result } as const)
                ),
                tap(({ token, result }) => {
                    if (!result.success) {
                        console.log(
                            `[CasualTreeServerSocketIO] ${
                                token.username
                            } not authenticated.`
                        );
                        socket.emit(
                            'login_result',
                            {
                                error: result.error,
                                message: 'Unable to authenticate',
                            },
                            null
                        );
                    } else {
                        console.log(
                            `[CasualTreeServerSocketIO] ${
                                token.username
                            } logged in!`
                        );
                    }
                }),
                switchMap(({ result }) =>
                    !result.success
                        ? empty()
                        : connectDevice(this._deviceManager, socket.id, {
                              ...result.info,
                              socket: socket,
                          }).pipe(
                              tap(device => {
                                  socket.emit(
                                      'login_result',
                                      null,
                                      result.info
                                  );
                              }),
                              mergeMap(
                                  device =>
                                      socketEvent(
                                          socket,
                                          'join_channel',
                                          (info: RealtimeChannelInfo) =>
                                              ({ info } as const)
                                      ),
                                  (device, info) => ({ device, ...info })
                              )
                          )
                ),
                mergeMap(
                    ({ info, device }) =>
                        this._authorizer.isAllowedToLoad(device.extra, info),
                    (data, canLoad) => ({ ...data, canLoad })
                ),
                tap(({ info, canLoad }) => {
                    if (!canLoad) {
                        console.log(
                            '[CausalTreeServerSocketIO] Not allowed to load channel: ' +
                                info.id
                        );
                        socket.emit(
                            `join_channel_result_${info.id}`,
                            'channel_doesnt_exist'
                        );
                    }
                }),
                switchMap(
                    ({ canLoad, info }) =>
                        !canLoad
                            ? empty()
                            : loadChannel(this._channelManager, info),
                    (data, loaded) => ({ ...data, loaded })
                ),
                concatMap(
                    ({ device, loaded }) =>
                        this._authorizer.isAllowedAccess(device.extra, loaded),
                    (data, authorized) => ({ ...data, authorized })
                ),
                tap(({ info, authorized, loaded }) => {
                    if (!authorized) {
                        console.log(
                            '[CausalTreeServerSocketIO] Not authorized:' +
                                info.id
                        );
                        loaded.subscription.unsubscribe();
                        socket.emit(
                            `join_channel_result_${info.id}`,
                            'unauthorized'
                        );
                    }
                }),
                switchMap(({ authorized, info, device, loaded }) =>
                    !authorized
                        ? empty()
                        : join(socket, info.id).pipe(
                              concatMap(() =>
                                  connectDeviceChannel(
                                      this._deviceManager,
                                      device,
                                      info
                                  )
                              ),
                              tap(() => {
                                  loaded.subscription.unsubscribe();
                                  socket.emit(
                                      `join_channel_result_${info.id}`,
                                      null
                                  );
                              })
                          )
                )
            );

            const sub = loginFlow.subscribe(null, err => console.error(err));

            socket.on('disconnect', () => {
                if (sub) {
                    sub.unsubscribe();
                }
            });
        });
    }
}

type LoginCallback = (err: any, info: DeviceInfo) => void;

function connectDevice(
    manager: DeviceManager,
    id: string,
    extra: any
): Observable<DeviceConnection<DeviceInfo>> {
    return Observable.create(
        (observer: Observer<DeviceConnection<DeviceInfo>>) => {
            let device: DeviceConnection<DeviceInfo>;

            setup();

            return new Subscription(() => {
                if (device) {
                    manager.disconnectDevice(device);
                }
            });

            async function setup() {
                try {
                    device = await manager.connectDevice(id, extra);
                    observer.next(device);
                } catch (err) {
                    observer.error(err);
                }
            }
        }
    );
}

function join(socket: Socket, id: string): Observable<void> {
    return Observable.create((observer: Observer<void>) => {
        socket.join(id, err => {
            if (err) {
                observer.error(err);
                return;
            }
            observer.next();
        });

        return () => {
            socket.leave(id);
        };
    });
}
