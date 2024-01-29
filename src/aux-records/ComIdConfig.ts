import { WEB_CONFIG_SCHEMA, WebConfig } from '@casual-simulation/aux-common';
import { z } from 'zod';

const ALLOWED_STUDIO_CREATORS_SCHEMA = z.union([
    z.literal('anyone'),
    z.literal('only-members'),
]);

export type AllowedStudioCreators = z.infer<
    typeof ALLOWED_STUDIO_CREATORS_SCHEMA
>;

export const COM_ID_CONFIG_SCHEMA = z.object({
    allowedStudioCreators: ALLOWED_STUDIO_CREATORS_SCHEMA.describe(
        'Who is allowed to create studios in this comId.'
    ),
});

export type ComIdConfig = z.infer<typeof COM_ID_CONFIG_SCHEMA>;

export const COM_ID_PLAYER_CONFIG = WEB_CONFIG_SCHEMA.pick({
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
    .partial();

export type ComIdPlayerConfig = z.infer<typeof COM_ID_PLAYER_CONFIG>;

export const COM_ID_WEB_CONFIG_SCHEMA = z.object({
    playerConfig: COM_ID_PLAYER_CONFIG,
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
