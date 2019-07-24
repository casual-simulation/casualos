import {
    ChannelAuthorizer,
    LoadedChannel,
} from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
    RealtimeChannelInfo,
} from '@casual-simulation/causal-trees';
import {
    createCalculationContext,
    getActiveObjects,
    whitelistOrBlacklistAllowsAccess,
    File,
    GLOBALS_FILE_ID,
    getFileStringList,
    FileEvent,
    isFileInContext,
    calculateFileValue,
    FileCalculationContext,
    calculateBooleanTagValue,
    parseRealtimeChannelId,
    getChannelFileById,
    getChannelMaxDevicesAllowed,
    getChannelConnectedDevices,
    getConnectedDevices,
    getMaxDevicesAllowed,
    getFileWhitelist,
    getFileBlacklist,
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { AuxLoadedChannel } from './AuxChannelManager';
import { VM2Sandbox } from '../vm/VM2Sandbox';
import { AuxChannelAuthorizer } from './AuxChannelAuthorizer';
import { difference, intersection } from 'lodash';
import {
    of,
    Observable,
    Subscription,
    Subject,
    throwError,
    Observer,
    BehaviorSubject,
} from 'rxjs';
import { NodeSimulation } from './NodeSimulation';
import {
    map,
    filter,
    startWith,
    tap,
    distinctUntilChanged,
    combineLatest,
} from 'rxjs/operators';

export class AuxUserAuthorizer implements AuxChannelAuthorizer {
    private _sub: Subscription;
    private _adminChannel: AuxLoadedChannel;
    private _sim: NodeSimulation;

    private _fileToChannelMap: Map<string, ChannelInfo>;
    private _channelMap: Map<string, ChannelInfo>;
    private _channelUpdated: Subject<string>;
    private _channelQueue: Map<string, string[]>;
    private _channelQueueUpdated: Subject<void>;
    private _globalQueueUpdated: Subject<void>;
    private _globalInfoUpdated: BehaviorSubject<void>;
    private _globalQueue: string[];
    private _globalInfo: GlobalInfo;

    constructor(adminChannel: AuxLoadedChannel) {
        this._adminChannel = adminChannel;
        this._sim = this._adminChannel.simulation;
        this._sub = new Subscription();
        this._fileToChannelMap = new Map();
        this._channelMap = new Map();
        this._channelQueue = new Map();
        this._globalQueue = [];
        this._channelUpdated = new Subject<string>();
        this._channelQueueUpdated = new Subject<void>();
        this._globalQueueUpdated = new Subject<void>();
        this._globalInfoUpdated = new BehaviorSubject<void>(null);

        const context = this._sim.helper.createContext();
        const globals = this._sim.helper.globalsFile;
        this._globalInfo = this._calculateGlobal(context, globals);

        this._sub.add(
            this._sim.watcher.filesDiscovered
                .pipe(tap(file => this._filesAdded(file)))
                .subscribe()
        );

        this._sub.add(
            this._sim.watcher.filesRemoved
                .pipe(tap(file => this._filesRemoved(file)))
                .subscribe()
        );

        this._sub.add(
            this._sim.watcher.filesUpdated
                .pipe(tap(file => this._filesUpdated(file)))
                .subscribe()
        );
    }

    private _filesAdded(files: File[]) {
        const context = this._sim.helper.createContext();

        for (let file of files) {
            if (file.id === GLOBALS_FILE_ID) {
                this._globalInfo = this._calculateGlobal(context, file);
                this._globalInfoUpdated.next();
            }

            if (isFileInContext(context, file, 'aux.channels')) {
                const channel = this._calculateChannel(context, file);
                if (channel.id) {
                    this._fileToChannelMap.set(file.id, channel);
                    this._channelMap.set(channel.id, channel);
                    this._channelUpdated.next(channel.id);
                }
            }
        }
    }

    private _filesRemoved(ids: string[]) {
        for (let id of ids) {
            const channel = this._fileToChannelMap.get(id);
            if (channel) {
                this._fileToChannelMap.delete(id);
                this._channelMap.delete(channel.id);
                this._channelUpdated.next(channel.id);
            }
        }
    }

    private _filesUpdated(files: File[]) {
        const context = this._sim.helper.createContext();

        for (let file of files) {
            if (file.id === GLOBALS_FILE_ID) {
                this._globalInfo = this._calculateGlobal(context, file);
                this._globalInfoUpdated.next();
            }

            if (isFileInContext(context, file, 'aux.channels')) {
                const channel = this._fileToChannelMap.get(file.id);
                if (channel) {
                    this._fileToChannelMap.delete(file.id);
                    this._channelMap.delete(channel.id);
                }

                const newChannel = this._calculateChannel(context, file);
                if (newChannel.id) {
                    this._fileToChannelMap.set(file.id, newChannel);
                    this._channelMap.set(newChannel.id, newChannel);
                }

                if (!channel || newChannel.id === channel.id) {
                    this._channelUpdated.next(newChannel.id);
                } else {
                    this._channelUpdated.next(channel.id);
                    this._channelUpdated.next(newChannel.id);
                }
            } else {
                const channel = this._fileToChannelMap.get(file.id);
                if (channel) {
                    this._fileToChannelMap.delete(file.id);
                    this._channelMap.delete(channel.id);
                    this._channelUpdated.next(channel.id);
                }
            }
        }
    }

    private _calculateChannel(
        context: FileCalculationContext,
        file: File
    ): ChannelInfo {
        return {
            id: calculateFileValue(context, file, 'aux.channel'),
            locked: calculateBooleanTagValue(
                context,
                file,
                'aux.channel.locked',
                false
            ),
            maxUsers: getChannelMaxDevicesAllowed(context, file),
        };
    }

    private _calculateGlobal(
        context: FileCalculationContext,
        file: File
    ): GlobalInfo {
        return {
            maxUsers: getMaxDevicesAllowed(context, file),
        };
    }

    isAllowedToLoad(
        device: DeviceInfo,
        info: RealtimeChannelInfo
    ): Observable<boolean> {
        if (info.id === 'aux-admin') {
            return of(true);
        }
        let channelId = parseRealtimeChannelId(info.id);
        let channels = this._channelUpdated.pipe(
            startWith(channelId),
            filter(id => id === channelId),
            map(id => this._channelMap.get(id)),
            map(channel => !!(channel && !channel.locked)),
            distinctUntilChanged()
        );

        return channels;
    }

    isAllowedAccess(
        device: DeviceInfo,
        channel: LoadedChannel
    ): Observable<boolean> {
        if (channel.info.type !== 'aux') {
            return throwError(new Error('Channel type must be "aux"'));
        }

        if (!device) {
            return of(false);
        }

        if (this._isAdmin(device)) {
            return of(true);
        }

        if (!this._isUser(device)) {
            return of(false);
        }

        const channelId = parseRealtimeChannelId(channel.info.id);

        return this._channelUpdated.pipe(
            startWith(channelId),
            combineLatest(
                this._channelQueuePosition(device, channelId),
                this._globalQueuePosition(device),
                this._globalInfoUpdated,
                (channelId, channelIndex, globalIndex) => ({
                    channelId,
                    channelIndex,
                    globalIndex,
                })
            ),
            filter(({ channelId: id }) => id === channelId),
            map(({ channelId: id, ...other }) => ({
                info: this._channelMap.get(id),
                ...other,
            })),
            map(({ info, channelIndex, globalIndex }) =>
                this._channelAllowsAccess(
                    device,
                    info,
                    channel,
                    channelIndex,
                    globalIndex
                )
            ),
            distinctUntilChanged()
        );
    }

    canProcessEvent(device: DeviceInfo, event: FileEvent): boolean {
        return this._isAdmin(device);
    }

    private _isAdmin(device: DeviceInfo) {
        return device.roles.indexOf(ADMIN_ROLE) >= 0;
    }

    private _isUser(device: DeviceInfo) {
        return device.roles.indexOf(USER_ROLE) >= 0;
    }

    private _channelQueuePosition(
        device: DeviceInfo,
        id: string
    ): Observable<number> {
        let queue = this._channelQueue.get(id);
        if (!queue) {
            queue = [];
            this._channelQueue.set(id, queue);
        }

        const username = device.claims[USERNAME_CLAIM];
        let index = queue.indexOf(username);
        if (index < 0) {
            index = queue.length;
            queue.push(username);
        }

        return Observable.create((observer: Observer<number>) => {
            observer.next(index);

            const sub = this._channelQueueUpdated.subscribe(() => {
                let index = queue.indexOf(username);
                observer.next(index);
            });

            sub.add(() => {
                let index = queue.indexOf(username);
                if (index >= 0) {
                    queue.splice(index, 1);
                    this._channelQueueUpdated.next();
                }
            });

            return sub;
        });
    }

    private _globalQueuePosition(device: DeviceInfo): Observable<number> {
        let queue = this._globalQueue;

        const username = device.claims[USERNAME_CLAIM];
        let index = queue.indexOf(username);
        if (index < 0) {
            index = queue.length;
            queue.push(username);
        }

        return Observable.create((observer: Observer<number>) => {
            observer.next(index);

            const sub = this._globalQueueUpdated.subscribe(() => {
                let index = queue.indexOf(username);
                observer.next(index);
            });

            sub.add(() => {
                let index = queue.indexOf(username);
                if (index >= 0) {
                    queue.splice(index, 1);
                    this._globalQueueUpdated.next();
                }
            });

            return sub;
        });
    }

    private _channelAllowsAccess(
        device: DeviceInfo,
        channelInfo: ChannelInfo,
        channel: LoadedChannel,
        channelIndex: number,
        globalIndex: number
    ): boolean {
        if (!channelInfo) {
            return true;
        }

        if (
            this._globalInfo.maxUsers &&
            globalIndex + 1 > this._globalInfo.maxUsers
        ) {
            return false;
        }

        if (channelInfo.maxUsers && channelIndex + 1 > channelInfo.maxUsers) {
            return false;
        }

        const sim = <AuxLoadedChannel>channel;
        const calc = sim.simulation.helper.createContext();

        const globalsFile: File = sim.tree.value[GLOBALS_FILE_ID];
        const username = device.claims[USERNAME_CLAIM];

        if (!globalsFile) {
            return true;
        }

        if (!whitelistOrBlacklistAllowsAccess(calc, globalsFile, username)) {
            return false;
        }

        const whitelist =
            getFileStringList(calc, globalsFile, 'aux.whitelist.roles') || [];
        const blacklist =
            getFileStringList(calc, globalsFile, 'aux.blacklist.roles') || [];

        const missingRoles = difference(whitelist, device.roles);
        if (missingRoles.length > 0) {
            return false;
        }

        const bannedRoles = intersection(blacklist, device.roles);
        if (bannedRoles.length > 0) {
            return false;
        }

        return true;
    }
}

interface ChannelInfo {
    id: string;
    locked: boolean;
    maxUsers: number;
}

interface GlobalInfo {
    maxUsers: number;
}
