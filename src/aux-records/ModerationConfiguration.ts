import z from 'zod';

export const moderationSchema = z.object({
    allowUnauthenticatedReports: z
        .boolean()
        .describe(
            'Whether to allow unauthenticated users to report insts. Defaults to true.'
        )
        .default(true),

    jobs: z
        .object({
            files: z
                .object({
                    enabled: z
                        .boolean()
                        .describe('Whether to enable file moderation.'),
                    fileExtensions: z
                        .array(z.string())
                        .describe(
                            'The file extensions to scan. Defaults to common image formats.'
                        )
                        .optional()
                        .default(['.png', '.webp', '.jpg', '.jpeg', '.gif']),
                })
                .describe('Options for moderating files.'),
        })
        .describe('The moderation jobs that are enabled.')
        .optional(),
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
