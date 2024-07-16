import { WebConfig } from '@casual-simulation/aux-common/common/WebConfig';
import { ServerConfig } from '@casual-simulation/aux-records';

export const DRIVES_URL = '/drives';

/**
 * The server config.
 */
export interface Config {
    /**
     * The config for the collaboration features of the server.
     */
    collaboration: {
        httpPort: number;
        player: ClientConfig;
        dist: string;
        drives: string;
        tls: TLSOptions | null;
        proxy: ProxyConfig;

        /**
         * Whether to enable debug logging.
         */
        debug: boolean;
    };

    /**
     * The options for the backend API.
     */
    backend: {
        httpPort: number;
        dist: string;
        config: ServerConfig;
    };
}

export type SandboxType = 'none' | 'deno';

export interface TLSOptions {
    key: string;
    cert: string;
}

export interface ClientConfig {
    index: string;
    manifest: string;
    web: WebConfig;
}

export interface DirectoryConfig {
    server: DirectoryServerConfig | null;
    client: DirectoryClientConfig | null;

    dbName: string;
}

export interface DirectoryServerConfig {
    /**
     * The secret that should be used for signing/verifying tokens.
     */
    secret: string;

    /**
     * The URL that webhooks should be sent to.
     */
    webhook: string | null;
}

export interface DirectoryClientConfig {
    /**
     * The base address of the directory that this AUXPlayer should upload its data to.
     */
    upstream: string;

    /**
     * The base address of the tunnel server that the AUXPlayer should connect to.
     */
    tunnel: string | null;

    /**
     * The local IP Address that the directory client should use.
     * If not provided, then the client will determine the local IP from the attached network interfaces.
     */
    ipAddress?: string;
}

/**
 * The proxy config.
 */
export interface ProxyConfig {
    /**
     * The IP Address range of proxies that should be trusted.
     */
    trust: string;
}
