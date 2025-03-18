import type { Plugin } from 'vite';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import { unified } from 'unified';
import { createFilter } from '@rollup/pluginutils';

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
