import { ChannelServerConfig } from "./ChannelServer";

/**
 * The server config.
 */
export interface Config {
    socket: SocketIO.ServerOptions,
    socketPort: number,
    httpPort: number,
    clients: ClientConfig[],
    channels: ChannelServerConfig,
};

export interface ClientConfig {
    dist: string;
    index: string;
    domains: string[];
}
