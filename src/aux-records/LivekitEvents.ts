export type IssueMeetTokenResult =
    | IssueMeetTokenSuccess
    | IssueMeetTokenFailure;

/**
 * Defines an interface that represents a successful "Issue meet token" result.
 */
export interface IssueMeetTokenSuccess {
    success: true;

    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The token that can be used to access the room.
     */
    token: string;

    /**
     * The URL that the meeting should connect to.
     */
    url: string;
}

export interface IssueMeetTokenFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_supported'
        | 'invalid_room_name'
        | 'invalid_username';
    errorMessage: string;
}
