import {
    DeviceAuthenticator,
    DeviceToken,
    DeviceInfo,
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
} from '@casual-simulation/causal-tree-server';
import { NodeSimulation } from '@casual-simulation/aux-vm-node';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    calculateFileValue,
    getFileUsernameList,
    FileCalculationContext,
    PrecalculatedFile,
    File,
    createFile,
    filesInContext,
} from '@casual-simulation/aux-common';
import { isFunction } from '@babel/types';

/**
 * Defines an authenticator that determines if a user is authenticated based on files in a simulation.
 */
export class AuxUserAuthenticator implements DeviceAuthenticator {
    private _sim: Simulation;

    /**
     * Creates a new AuxUserAuthenticator for the given simulation.
     * @param adminSimulation The simulation that users should be looked up in.
     */
    constructor(adminSimulation: Simulation) {
        this._sim = adminSimulation;
    }

    async authenticate(token: DeviceToken): Promise<DeviceInfo> {
        let context = this._sim.helper.createContext();
        let userFiles = this._sim.helper.objects.filter(o =>
            calculateFileValue(context, o, 'aux.username')
        );
        let filesForUsername = userFiles.filter(o =>
            this._matchesUsername(context, o, token)
        );
        let files = filesForUsername.filter(o =>
            this._matchesToken(context, o, token)
        );

        let file: PrecalculatedFile;
        if (files.length > 0) {
            file = files[0];
        } else if (filesForUsername.length === 0) {
            file = await this._createLoginFile(token, userFiles.length === 0);
        }

        if (file) {
            const roles = calculateFileValue(context, file, 'aux.roles');
            const username = calculateFileValue(context, file, 'aux.username');

            let finalRoles = new Set<string>(roles || []);
            finalRoles.add(USER_ROLE);

            return {
                claims: {
                    [USERNAME_CLAIM]: username,
                },
                roles: [...finalRoles],
            };
        }
        return null;
    }

    private _matchesUsername(
        context: FileCalculationContext,
        file: PrecalculatedFile,
        token: DeviceToken
    ): boolean {
        return (
            calculateFileValue(context, file, 'aux.username') === token.username
        );
    }

    private _matchesToken(
        context: FileCalculationContext,
        file: PrecalculatedFile,
        token: DeviceToken
    ): boolean {
        return calculateFileValue(context, file, 'aux.token') === token.token;
    }

    private async _createLoginFile(
        token: DeviceToken,
        firstUser: boolean
    ): Promise<PrecalculatedFile> {
        const id = await this._sim.helper.createFile(undefined, {
            'aux.users': true,
            'aux.username': token.username,
            'aux.token': token.token,
            'aux.roles': firstUser ? [ADMIN_ROLE] : [],
        });

        return this._sim.helper.filesState[id];
    }
}
