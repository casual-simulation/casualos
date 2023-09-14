import { parseConnectionToken } from './ConnectionToken';

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

/**
 * Gets the connection ID for the given indicator.
 * @param indicator The indicator.
 */
export function getConnectionId(indicator: ConnectionIndicator) {
    if (!indicator) {
        return null;
    }
    if ('connectionToken' in indicator) {
        const parsed = parseConnectionToken(indicator.connectionToken);
        if (parsed) {
            return parsed[2];
        } else {
            return null;
        }
    } else {
        return indicator.connectionId;
    }
}
