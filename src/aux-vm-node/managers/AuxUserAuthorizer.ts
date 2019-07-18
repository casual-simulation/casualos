import {
    ChannelAuthorizer,
    LoadedChannel,
} from '@casual-simulation/causal-tree-server';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    createCalculationContext,
    getActiveObjects,
    whitelistOrBlacklistAllowsAccess,
    File,
    GLOBALS_FILE_ID,
    getFileStringList,
    FileEvent,
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { AuxLoadedChannel } from './AuxChannelManager';
import { VM2Sandbox } from '../vm/VM2Sandbox';
import { AuxChannelAuthorizer } from './AuxChannelAuthorizer';
import { difference, intersection } from 'lodash';

export class AuxUserAuthorizer implements AuxChannelAuthorizer {
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

        const objects = getActiveObjects(sim.tree.value);
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
