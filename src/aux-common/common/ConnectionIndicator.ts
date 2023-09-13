/**
 * Defines an interface that represents a connection indicator.
 * That is, the information that a client needs to establish a connection.
 */
export type ConnectionIndicator =
    | ConnectionIndicatorToken
    | ConnectionIndicatorId;

/**
 * Defines an interface that represents a connection token.
 */
export interface ConnectionIndicatorToken {
    /**
     * The connection token that should be used.
     */
    connectionToken: string;
}

/**
 * Defines an interface that represents a connection ID.
 */
export interface ConnectionIndicatorId {
    /**
     * The connection ID that should be used.
     */
    connectionId: string;
}
