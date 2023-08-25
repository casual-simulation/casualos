import { z } from 'zod';

export interface ConnectionInfo {
    /**
     * The ID of the connection.
     */
    connectionId: string;

    /**
     * The ID of the session.
     */
    sessionId: string;

    /**
     * The ID of the user that is associated with the connection.
     */
    userId: string;
}
export const connectionInfoSchema = z.object({
    connectionId: z.string(),
    sessionId: z.string(),
    userId: z.string(),
});
type ZodConnectionInfo = z.infer<typeof connectionInfoSchema>;
type ZodConnectionInfoAssertion = HasType<ZodConnectionInfo, ConnectionInfo>;

type HasType<T, Q extends T> = Q;
