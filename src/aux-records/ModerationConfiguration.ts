/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import z from 'zod';

export const moderationSchema = z.object({
    allowUnauthenticatedReports: z
        .boolean()
        .prefault(true)
        .describe(
            'Whether to allow unauthenticated users to report insts. Defaults to true.'
        ),

    jobs: z
        .object({
            files: z
                .object({
                    enabled: z
                        .boolean()
                        .describe('Whether to enable file moderation.'),

                    fileExtensions: z
                        .array(z.string())
                        .optional()
                        .prefault(['.png', '.webp', '.jpg', '.jpeg', '.gif'])
                        .describe(
                            'The file extensions to scan. Defaults to common image formats.'
                        ),

                    minConfidence: z
                        .number()
                        .min(0)
                        .max(1)
                        .optional()
                        .describe(
                            'The minimum confidence to consider a detected label. Should be between 0 and 1. For AWS Rekognition, this defaults to 0.5.'
                        ),

                    bannedLabels: z
                        .array(
                            z.object({
                                label: z
                                    .string()
                                    .optional()
                                    .describe(
                                        'The label that should be matched. If omitted, then labels will be matched by category. See https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html#moderation-api for AWS Rekognition moderation labels.'
                                    ),

                                threshold: z
                                    .number()
                                    .min(0)
                                    .max(1)
                                    .prefault(0.7)
                                    .describe(
                                        'The threshold that the label confidence must equal or exceed in order to be considered a match. Defaults to 0.7.'
                                    ),

                                actions: z
                                    .array(z.enum(['notify']))
                                    .optional()
                                    .prefault(['notify'])
                                    .describe(
                                        'The actions that should be taken when a file is detected with the label. Defaults to [notify].'
                                    ),
                            })
                        )
                        .optional()
                        .prefault([
                            {
                                label: 'Explicit',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Non-Explicit Nudity of Intimate parts and Kissing',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Swimwear or Underwear',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Violence',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Visually Disturbing',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Drugs & Tobacco',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Alcohol',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Rude Gestures',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Gambling',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                            {
                                label: 'Hate Symbols',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                        ])
                        .describe(
                            'The labels that should be banned. If a file contains any of these labels, it will be marked as banned. Additionally, a notification will be sent '
                        ),
                })
                .describe('Options for moderating files.'),
        })
        .optional()
        .describe('The moderation jobs that are enabled.'),
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
