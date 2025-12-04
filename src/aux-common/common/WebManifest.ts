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

/**
 * The schema for the PWA web manifest.
 */
export const WEB_MANIFEST_SCHEMA = z
    .looseObject({
        name: z.string().describe('The name of the PWA app.'),
        short_name: z.string().describe('The short name of the PWA app.'),
        description: z
            .string()
            .optional()
            .describe('The description of the PWA app.'),
        start_url: z
            .string()
            .prefault('/')
            .describe(
                'The URL that should be launched when opening the PWA. Defaults to "/"'
            ),
        display: z
            .enum(['fullscreen', 'standalone', 'minimal-ui', 'browser'])
            .prefault('standalone')
            .describe('The display mode that should be used for the PWA app.'),
        background_color: z
            .string()
            .prefault('#ffffff')
            .describe(
                'The background color that should be used on the splash screen when the PWA is launched.'
            ),
        theme_color: z
            .string()
            .prefault('#000000')
            .describe('The theme color that should be used for the PWA app.'),
        icons: z
            .array(
                z.object({
                    src: z.string().describe('The source URL of the icon.'),
                    type: z.string().describe('The MIME type of the icon.'),
                    sizes: z
                        .union([
                            z
                                .literal('any')
                                .describe(
                                    'The icon is scalable and can be used at any size.'
                                ),
                            z
                                .string()
                                .check(z.regex(/^(\d+x\d+)(\s+\d+x\d+)*$/))
                                .describe('The sizes of the icon.'),
                        ])
                        .describe(
                            'The size(s) that the icon can display formatted as "{width}x{height}". Use "any" for scalable icons like SVG.'
                        ),
                    purpose: z
                        .string()
                        .optional()
                        .describe('The purpose of the icon.'),
                })
            )
            .prefault([
                {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                },
                {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                },
                {
                    src: '/pwa-maskable-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'maskable',
                },
                {
                    src: '/pwa-maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                },
            ])
            .describe(
                'The icons that should be used for the PWA app.\nSee https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons\nAlso see https://favicon.inbrowser.app/tools/favicon-generator to generate icons.'
            ),
    })
    .refine((obj) => Object.keys(obj).length < 20, {
        error: 'Web manifest has too many top-level properties. Maximum allowed is 20.',
    })
    .optional();

export type WebManifest = z.infer<typeof WEB_MANIFEST_SCHEMA>;
