/**
 * Defines an interface that represents an event from a remote peer.
 */
export interface ConnectionEvent {
    /**
     * The name of the event.
     */
    name: string;
    /**
     * The data contained in the event.
     */
    data: any;
}
