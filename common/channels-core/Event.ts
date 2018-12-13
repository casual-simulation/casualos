
/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 */
export interface Event {
    /**
     * The type of the event. 
     * This helps determine how the event should be applied to the state.
     */
    type: string;

    /**
     * The time that the event got registered by the server.
     */
    creation_time: Date;
}