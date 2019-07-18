/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 * @deprecated
 */
export interface Event {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
}
