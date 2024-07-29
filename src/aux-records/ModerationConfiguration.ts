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

                    minConfidence: z
                        .number()
                        .describe(
                            'The minimum confidence to consider a detected label. Should be between 0 and 1. For AWS Rekognition, this defaults to 0.5.'
                        )
                        .min(0)
                        .max(1)
                        .optional(),

                    bannedLabels: z
                        .array(
                            z.object({
                                label: z
                                    .string()
                                    .describe(
                                        'The label that should be matched. If omitted, then labels will be matched by category. See https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html#moderation-api for AWS Rekognition moderation labels.'
                                    )
                                    .optional(),

                                threshold: z
                                    .number()
                                    .describe(
                                        'The threshold that the label confidence must equal or exceed in order to be considered a match. Defaults to 0.7.'
                                    )
                                    .min(0)
                                    .max(1)
                                    .default(0.7),

                                actions: z
                                    .array(z.enum(['notify']))
                                    .describe(
                                        'The actions that should be taken when a file is detected with the label. Defaults to [notify].'
                                    )
                                    .optional()
                                    .default(['notify']),
                            })
                        )
                        .describe(
                            'The labels that should be banned. If a file contains any of these labels, it will be marked as banned. Additionally, a notification will be sent '
                        ),
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
