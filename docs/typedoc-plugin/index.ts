const path = require('path');
import { loadContent } from './loader';
const VirtualModulesPlugin = require('webpack-virtual-modules');
import { ReferenceType, Reflection, ReflectionType, Type } from 'typedoc';
import { getProject } from './api';
import { sortBy } from 'lodash';
import { writeFile, mkdir, rmdir } from 'fs/promises';
import { render } from 'mustache';
import Template from './template.mdx';

const basePath = path.resolve(__dirname, 'static', 'api');
const jsonDist = path.resolve(basePath, 'static', 'api');

async function start() {
    const content = loadContent();

    try {
        await rmdir(jsonDist, { recursive: true });
    } catch{}
    await mkdir(jsonDist, { recursive: true });

    for (let page of content.pages) {
        let pagePath = page.hash;

        console.log('[docusarus-plugin-typedoc] Saving page data: ', pagePath);
        const fullPath =path.resolve(jsonDist, `${pagePath}.json`);
        const dirname = path.dirname(fullPath);
        const fileName = path.basename(fullPath);
        
        await mkdir(dirname, { recursive: true });
        await writeFile(fullPath, JSON.stringify(page, null, 4), {
            encoding: 'utf-8'
        });

        const pageContents = render(Template, {
            id: fileName,
            title: fileName,
            sidebar_label: 'test',
            description: 'test description',
            importPath: `@site/${fullPath.substring(basePath.length).replace(/\\/g, '/')}`
        });

        const docPath = path.resolve(basePath, 'docs', `${pagePath}.mdx`);
        await mkdir(path.dirname(docPath), { recursive: true });

        console.log('[docusarus-plugin-typedoc] Saving page: ', docPath);
        await writeFile(docPath, pageContents, {
            encoding: 'utf-8'
        });

        // console.log('[docusarus-plugin-typedoc] Adding route: ', pagePath);
        // addRoute({
        //     path: `/${pagePath}`,
        //     component: '@site/src/components/ApiPage.jsx',
        //     modules: {
        //         apiInfo: pageData
        //     }
        // });
    }

}

start();