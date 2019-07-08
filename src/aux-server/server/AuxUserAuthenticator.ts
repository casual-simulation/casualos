import {
    DeviceAuthenticator,
    DeviceToken,
    DeviceInfo,
    USERNAME_CLAIM,
} from '@casual-simulation/causal-tree-server';
import { NodeSimulation } from '@casual-simulation/aux-vm-node';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    calculateFileValue,
    getFileUsernameList,
    FileCalculationContext,
    PrecalculatedFile,
} from '@casual-simulation/aux-common';
import { isFunction } from '@babel/types';

/**
 * Defines an authenticator that determines if a user is authenticated based on files in a simulation.
 */
export class AuxUserAuthenticator implements DeviceAuthenticator {
    private _sim: Simulation;

    /**
     * Creates a new AuxUserAuthenticator for the given simulation.
     * @param simulation
     */
    constructor(simulation: Simulation) {
        this._sim = simulation;
    }

    async authenticate(token: DeviceToken): Promise<DeviceInfo> {
        let context = this._sim.helper.createContext();
        let files = this._sim.helper.objects.filter(o =>
            this.matchesToken(context, o, token)
        );

        if (files.length > 0) {
            let file = files[0];

            const roles = calculateFileValue(context, file, 'aux.roles');
            const username = calculateFileValue(context, file, 'aux.username');

            return {
                claims: {
                    [USERNAME_CLAIM]: username,
                },
                roles: roles,
            };
        }
        return null;
    }

    private matchesToken(
        context: FileCalculationContext,
        o: PrecalculatedFile,
        token: DeviceToken
    ): unknown {
        return (
            calculateFileValue(context, o, 'aux.username') === token.username &&
            calculateFileValue(context, o, 'aux.token') === token.token
        );
    }
}
