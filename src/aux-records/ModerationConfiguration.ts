import z from 'zod';

export const moderationSchema = z.object({
    allowUnauthenticatedReports: z
        .boolean()
        .describe(
            'Whether to allow unauthenticated users to report insts. Defaults to true.'
        )
        .default(true),
});

export type ModerationConfiguration = z.infer<typeof moderationSchema>;

export function parseModerationConfiguration(
    config: any,
    defaultConfig: ModerationConfiguration
): ModerationConfiguration {
    if (config) {
        const result = moderationSchema.safeParse(config);
        if (result.success) {
            return result.data as ModerationConfiguration;
        } else {
            console.error(
                '[ModerationConfiguration] Invalid privo config',
                result
            );
        }
    }
    return defaultConfig;
}
