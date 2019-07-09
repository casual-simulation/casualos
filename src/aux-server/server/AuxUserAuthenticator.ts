import {
    DeviceAuthenticator,
    DeviceToken,
    DeviceInfo,
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    LoadedChannel,
} from '@casual-simulation/causal-tree-server';
import { NodeSimulation, VM2Sandbox } from '@casual-simulation/aux-vm-node';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    calculateFileValue,
    getFileUsernameList,
    FileCalculationContext,
    PrecalculatedFile,
    File,
    createFile,
    filesInContext,
    getActiveObjects,
    createCalculationContext,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import formulaLib from '@casual-simulation/aux-common/Formulas/formula-lib';

/**
 * Defines an authenticator that determines if a user is authenticated based on files in a simulation.
 */
export class AuxUserAuthenticator implements DeviceAuthenticator {
    private _sim: LoadedChannel;
    private _tree: AuxCausalTree;

    /**
     * Creates a new AuxUserAuthenticator for the given channel.
     * @param adminChannel The channel that users should be looked up in.
     */
    constructor(adminChannel: LoadedChannel) {
        this._sim = adminChannel;
        this._tree = <AuxCausalTree>adminChannel.tree;
    }

    async authenticate(token: DeviceToken): Promise<DeviceInfo> {
        const objects = getActiveObjects(this._sim.tree.value);
        const context = createCalculationContext(
            objects,
            undefined,
            formulaLib,
            lib => new VM2Sandbox(lib)
        );
        let userFiles = objects.filter(o =>
            calculateFileValue(context, o, 'aux.username')
        );
        let filesForUsername = userFiles.filter(o =>
            this._matchesUsername(context, o, token)
        );
        let files = filesForUsername.filter(o =>
            this._matchesToken(context, o, token)
        );

        let file: File;
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
        file: File,
        token: DeviceToken
    ): boolean {
        return (
            calculateFileValue(context, file, 'aux.username') === token.username
        );
    }

    private _matchesToken(
        context: FileCalculationContext,
        file: File,
        token: DeviceToken
    ): boolean {
        return calculateFileValue(context, file, 'aux.token') === token.token;
    }

    private async _createLoginFile(
        token: DeviceToken,
        firstUser: boolean
    ): Promise<File> {
        const file = createFile(undefined, {
            'aux.users': true,
            'aux.username': token.username,
            'aux.token': token.token,
            'aux.roles': firstUser ? [ADMIN_ROLE] : [],
        });
        await this._tree.addFile(file);

        return this._tree.value[file.id];
    }
}
