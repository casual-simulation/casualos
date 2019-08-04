import {
    AuxCausalTree,
    FormulaLibraryOptions,
} from '@casual-simulation/aux-common';
import { AuxUser } from '@casual-simulation/aux-vm';
import { NodeSimulation } from './NodeSimulation';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { getSandbox } from '../vm/VM2Sandbox';
import { NullCausalTreeStore } from '@casual-simulation/causal-trees';
import { NodeSigningCryptoImpl } from '@casual-simulation/crypto-node';
import {
    RemoteAuxChannel,
    RemoteSimulation,
    RemoteSimulationImpl,
} from '@casual-simulation/aux-vm-client';
import { AuxVMNode } from '../vm/AuxVMNode';

/**
 * Creates a new NodeSimulation for the given AuxCausalTree using the given user, channel ID, and config.
 */
export function nodeSimulationFromTree(
    tree: AuxCausalTree,
    user: AuxUser,
    id: string,
    config: FormulaLibraryOptions['config']
): NodeSimulation {
    return new NodeSimulation(
        id,
        config,
        cfg => new NodeAuxChannel(tree, user, cfg)
    );
}

/**
 * Creates a new NodeSimulation which interfaces with a remote server as the given user to load the channel with the given ID using the given config.
 * @param host The host to interface with.
 * @param user The user.
 * @param id The ID of the channel to load.
 * @param config The config.
 */
export function nodeSimulationForRemote(
    host: string,
    user: AuxUser,
    id: string,
    config: FormulaLibraryOptions['config']
): RemoteSimulation {
    return new RemoteSimulationImpl(
        id,
        config,
        cfg =>
            new AuxVMNode(
                new RemoteAuxChannel(host, user, cfg, {
                    store: new NullCausalTreeStore(),
                    crypto: new NodeSigningCryptoImpl('ECDSA-SHA256-NISTP256'),
                    sandboxFactory: lib => getSandbox(lib),
                })
            )
    );
}
