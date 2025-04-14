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
import { getImageClassifierUrls, inferPath } from './ImageClassifierUtils';

describe('getImageClassifierUrls()', () => {
    const cases = [
        [
            'infer the json and metadata from the model URL',
            { modelUrl: 'https://example.com/my-model' },
            {
                json: 'https://example.com/my-model/model.json',
                metadata: 'https://example.com/my-model/metadata.json',
            },
        ] as const,
        [
            'support URLs that end with a /',
            { modelUrl: 'https://example.com/my-model/' },
            {
                json: 'https://example.com/my-model/model.json',
                metadata: 'https://example.com/my-model/metadata.json',
            },
        ] as const,
        [
            'support overriding the JSON URL',
            {
                modelUrl: 'https://example.com/my-model/',
                modelJsonUrl: 'https://example.com/test.json',
            },
            {
                json: 'https://example.com/test.json',
                metadata: 'https://example.com/my-model/metadata.json',
            },
        ] as const,
        [
            'support overriding the metadata URL',
            {
                modelUrl: 'https://example.com/my-model/',
                modelMetadataUrl: 'https://example.com/test.json',
            },
            {
                json: 'https://example.com/my-model/model.json',
                metadata: 'https://example.com/test.json',
            },
        ] as const,
        [
            'support overriding both URLs',
            {
                modelJsonUrl: 'https://example.com/test1.json',
                modelMetadataUrl: 'https://example.com/test2.json',
            },
            {
                json: 'https://example.com/test1.json',
                metadata: 'https://example.com/test2.json',
            },
        ] as const,
    ];

    it.each(cases)('should %s', (desc, options, expected) => {
        expect(getImageClassifierUrls(options)).toEqual(expected);
    });
});

describe('inferPath()', () => {
    const cases = [
        ['http://example.com', 'path', 'http://example.com/path'],
        ['http://example.com/', 'path', 'http://example.com/path'],
        ['http://example.com/test', 'path', 'http://example.com/test/path'],
        ['http://example.com/test/', 'path', 'http://example.com/test/path'],
        ['http://example.com/test', '/path', 'http://example.com/path'],
        [
            'http://example.com/test.xyz',
            'path',
            'http://example.com/test.xyz/path',
        ],
        ['http://example.com/test', './path', 'http://example.com/test/path'],
    ];

    it.each(cases)('should map %s + %s to %s', (base, relative, result) => {
        expect(inferPath(base, relative)).toBe(result);
    });
});
