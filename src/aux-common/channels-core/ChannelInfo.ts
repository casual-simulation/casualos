
/**
 * Generic information about a channel.
 */
export interface ChannelInfo {
    /**
     * The type of the channel.
     * This indicates what type of state store a channel should use.
     */
    type: string;

    /**
     * The unique ID of the channel.
     * GUIDs are usually used for private invite-only channels while
     * structured names are used for public channels. (like `namespace/room/channel-name`)
     */
    id: string;

    /**
     * The human-readable name of the channel.
     */
    name: string | null;
}
