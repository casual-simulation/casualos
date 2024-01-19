import { WEB_CONFIG_SCHEMA, WebConfig } from '@casual-simulation/aux-common';
import { z } from 'zod';

/**
 * Defines an interface that represents the comId configuration for a web client.
 */
export interface ComIdWebConfig {
    /**
     * The player configuration that should be used.
     */
    playerConfig: Partial<WebConfig>;
}

export const COM_ID_WEB_CONFIG_SCHEMA = z.object({
    playerConfig: WEB_CONFIG_SCHEMA.partial(),
});
