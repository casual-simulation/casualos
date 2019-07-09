import {
    ChannelAuthorizer,
    DeviceInfo,
    LoadedChannel,
    ADMIN_ROLE,
    USER_ROLE,
    USERNAME_CLAIM,
} from '@casual-simulation/causal-tree-server';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    createCalculationContext,
    getActiveObjects,
    whitelistOrBlacklistAllowsAccess,
    File,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';
import { VM2Sandbox } from '@casual-simulation/aux-vm-node';

export class AuxUserAuthorizer implements ChannelAuthorizer {
    isAllowedAccess(device: DeviceInfo, channel: LoadedChannel): boolean {
        if (channel.info.type !== 'aux') {
            throw new Error('Channel type must be "aux"');
        }

        if (!device) {
            return false;
        }

        if (this._isAdmin(device)) {
            return true;
        }

        if (!this._isUser(device)) {
            return false;
        }

        const objects = getActiveObjects(channel.tree.value);
        const globalsFile: File = channel.tree.value[GLOBALS_FILE_ID];
        const calc = createCalculationContext(
            objects,
            undefined,
            formulaLib,
            lib => new VM2Sandbox(lib)
        );
        const username = device.claims[USERNAME_CLAIM];

        if (!whitelistOrBlacklistAllowsAccess(calc, globalsFile, username)) {
            return false;
        }

        return true;
    }

    private _isAdmin(device: DeviceInfo) {
        return device.roles.indexOf(ADMIN_ROLE) >= 0;
    }

    private _isUser(device: DeviceInfo) {
        return device.roles.indexOf(USER_ROLE) >= 0;
    }
}
