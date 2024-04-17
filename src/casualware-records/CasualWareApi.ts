import { procedure } from '@casual-simulation/aux-common';
import {
    RecordsServer,
    formatResponse,
    returnResult,
} from '@casual-simulation/aux-records';
import { BuildReturn } from '@casual-simulation/aux-server/aux-backend/shared/ServerBuilder';
import { z } from 'zod';

/**
 * Creates the procedures for the CasualWare API.
 * @param server
 * @returns
 */
export function createCasualWareProcedures(
    server: RecordsServer,
    results: BuildReturn
) {
    return {
        casualWareSupported: procedure()
            .origins(true)
            .http('GET', '/api/casualware/supported')
            .inputs(z.object({}))
            .handler(async (_, context) => {
                return {
                    success: true,
                };
            }),
    };
}

/**
 * Configures the given server with the CasualWare API procedures.
 * @param server The server to configure.
 */
export function configureRoutes(server: RecordsServer, results: BuildReturn) {
    server.addProcedures(createCasualWareProcedures(server, results));
}
