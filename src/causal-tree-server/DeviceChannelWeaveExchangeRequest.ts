import { AtomOp, StoredCausalTree } from '@casual-simulation/causal-trees';
/**
 * Defines a request from the client to exchange weaves for a channel.
 */
export interface DeviceChannelWeaveExchangeRequest {
    /**
     * The callback which sends the response back to the client.
     */
    callback: (resp: StoredCausalTree<AtomOp>) => void;
    /**
     * The weave that should be imported from the client.
     */
    weave: StoredCausalTree<AtomOp>;
}
