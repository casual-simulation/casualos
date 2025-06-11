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
import type { Plugin } from 'vite';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import rehypeSlug from 'rehype-slug';
import { unified } from 'unified';

export interface Options {
    files: {
        [fileName: string]: string;
    };

    include?: any;
    exclude?: any;
}

const fileRegex = /\.(md)$/;

export default function markdownPlugin(options: Options = {}): Plugin {
    const pipeline = unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeSlug)
        .use(rehypeStringify, { allowDangerousHtml: true });

    return {
        name: 'markdown',
        async transform(code, id) {
            if (!fileRegex.test(id)) return;

            const result = await pipeline.process(code);
            return {
                code: `export default ${JSON.stringify(result.toString())};`,
                map: null,
            };
        },
    };
}
