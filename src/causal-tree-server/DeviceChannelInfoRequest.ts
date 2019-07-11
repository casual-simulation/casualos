import { SiteVersionInfo } from '@casual-simulation/causal-trees';
/**
 * Defines a request from the client to exchange version info for a channel.
 */
export interface DeviceChannelInfoRequest {
    /**
     * The callback which sends the response back to the client.
     */
    callback: (info: SiteVersionInfo) => void;
    /**
     * The site version info from the client.
     */
    clientInfo: SiteVersionInfo;
}
