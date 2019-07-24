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
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { AuxLoadedChannel } from './AuxChannelManager';
import { VM2Sandbox } from '../vm/VM2Sandbox';
import { AuxChannelAuthorizer } from './AuxChannelAuthorizer';
import { difference, intersection } from 'lodash';
import { of, Observable, Subscription, Subject } from 'rxjs';
import { NodeSimulation } from './NodeSimulation';
import {
    map,
    filter,
    startWith,
    tap,
    distinctUntilChanged,
} from 'rxjs/operators';

export class AuxUserAuthorizer implements AuxChannelAuthorizer {
    private _sub: Subscription;
    private _adminChannel: AuxLoadedChannel;
    private _sim: NodeSimulation;

    private _fileToChannelMap: Map<string, ChannelInfo>;
    private _channelMap: Map<string, ChannelInfo>;
    private _channelUpdated: Subject<string>;

    constructor(adminChannel: AuxLoadedChannel) {
        this._adminChannel = adminChannel;
        this._sim = this._adminChannel.simulation;
        this._sub = new Subscription();
        this._fileToChannelMap = new Map();
        this._channelMap = new Map();
        this._channelUpdated = new Subject<string>();

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
        };
    }

    isAllowedToLoad(
        device: DeviceInfo,
        info: RealtimeChannelInfo
    ): Observable<boolean> {
        if (info.id === 'aux-admin') {
            return of(true);
        }
        let channelId = info.id.substring(4);
        let channels = this._channelUpdated.pipe(
            startWith(channelId),
            filter(id => id === channelId),
            map(id => this._channelMap.get(id)),
            map(channel => !!(channel && !channel.locked)),
            distinctUntilChanged()
        );

        return channels;
    }

    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        if (channel.info.type !== 'aux') {
            throw new Error('Channel type must be "aux"');
        }

        const sim = <AuxLoadedChannel>channel;

        if (!device) {
            return false;
        }

        if (this._isAdmin(device)) {
            return true;
        }

        if (!this._isUser(device)) {
            return false;
        }

        const adminCalc = this._sim.helper.createContext();
        const id = parseRealtimeChannelId(channel.info.id);
        const channelFile = getChannelFileById(adminCalc, id);

        if (channelFile) {
            const maxAllowed = getChannelMaxDevicesAllowed(
                adminCalc,
                channelFile
            );
            const current = getChannelConnectedDevices(adminCalc, channelFile);

            if (current >= maxAllowed) {
                return false;
            }
        }

        const globalsFile: File = sim.tree.value[GLOBALS_FILE_ID];

        if (!globalsFile) {
            return true;
        }

        const calc = sim.channel.helper.createContext();
        const username = device.claims[USERNAME_CLAIM];

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

    canProcessEvent(device: DeviceInfo, event: FileEvent): boolean {
        return this._isAdmin(device);
    }

    private _isAdmin(device: DeviceInfo) {
        return device.roles.indexOf(ADMIN_ROLE) >= 0;
    }

    private _isUser(device: DeviceInfo) {
        return device.roles.indexOf(USER_ROLE) >= 0;
    }
}

interface ChannelInfo {
    id: string;
    locked: boolean;
}
