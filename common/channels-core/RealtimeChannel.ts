import { RealtimeChannelInfo } from "./RealtimeChannelInfo";

/**
 * Defines an interface for a realtime channel.
 * A realtime channel is a graph of operations (a.k.a events) that are applied in a particular order.
 * 
 * It is a graph instead of a list because operations are ordered based on parent references and not timestamp.
 * 
 * Note that realtime channels are only a data structure for organizing a list of operations.
 * They have nothing to do with sending/receiving events over the wire.
 * That's what realtime channel connectors are for.
 */
export interface RealtimeChannel<T> {

    /**
     * The info about the channel.
     */
    info: RealtimeChannelInfo;


}