
/**
 * Defines an interface that contains information about a realtime channel.
 */
export interface RealtimeChannelInfo {
    /**
     * The type of the channel.
     * This is usually used as an indicator of the type of events
     * that consumers are able to expect from the channel.
     */
    type: string;

    /**
     * The unique ID of the channel.
     * GUIDs are usually used for private invite-only channels while
     * structured names are used for public channels. (like `namespace/room/channel-name`)
     */
    id: string;
}