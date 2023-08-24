import { ConnectionInfo } from './ConnectionInfo';

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 */
export interface Action {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;

    /**
     * Whether the action can be structure cloned.
     * If true, then the action should not be passed across message ports.
     */
    uncopiable?: boolean;
}
