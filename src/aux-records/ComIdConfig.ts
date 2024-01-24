import { WEB_CONFIG_SCHEMA, WebConfig } from '@casual-simulation/aux-common';
import { z } from 'zod';

export const COM_ID_CONFIG_SCHEMA = z.object({
    allowAnyoneToCreateStudios: z
        .boolean()
        .describe(
            'Whether anyone should be allowed to create a studio in this comId.'
        ),
});

export type ComIdConfig = z.infer<typeof COM_ID_CONFIG_SCHEMA>;

/**
 * Defines an interface that represents the comId configuration for a web client.
 */
export interface ComIdWebConfig {
    /**
     * The player configuration that should be used.
     */
    playerConfig: Partial<WebConfig>;

    /**
     * The name of the comId.
     */
    name: string;

    /**
     * The URL of the logo that should be used for this comId.
     */
    logoUrl: string | null;
}

export const COM_ID_WEB_CONFIG_SCHEMA = z.object({
    playerConfig: WEB_CONFIG_SCHEMA.pick({
        ab1BootstrapURL: true,
        allowedBiosOptions: true,
        arcGisApiKey: true,
        automaticBiosOption: true,
        defaultBiosOption: true,
        jitsiAppName: true,
        what3WordsApiKey: true,
    })
        .describe(
            'The configuration that the comId provides which overrides the default player configuration.'
        )
        .partial(),
    name: z
        .string()
        .describe('The name of the studio that this comId represents.'),
    logoUrl: z
        .string()
        .describe(
            'The URL of the logo that represents this comId. If null, then the comId does not have a logo.'
        )
        .nullable(),
});
