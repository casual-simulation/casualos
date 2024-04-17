import { configureRoutes } from './CasualWareApi';
import type { ServerPlugin } from '@casual-simulation/aux-server/aux-backend/shared/ServerBuilder';

export default {
    name: 'casualware-api',
    configureServer: (server, results) => {
        configureRoutes(server, results);
    },
} as ServerPlugin;
