const path = require('path');
import { Content, loadContent } from './loader';
const VirtualModulesPlugin = require('webpack-virtual-modules');
import { ReferenceType, Reflection, ReflectionType, Type } from 'typedoc';
import { sortBy } from 'lodash';
import { writeFile, mkdir, rmdir, readFile } from 'fs/promises';
import { render } from 'mustache';
import Template from './templates/generic.mdx';
// import { renderToString } from 'react-dom/server';
import { renderDoc } from './doc';


const basePath = path.resolve(__dirname, '..', '..');
const templatesPath = path.resolve(basePath, 'typedoc-plugin', 'templates');
const jsonDist = path.resolve(basePath, 'docs', 'api-info');

const apiFullPath = path.resolve(basePath, 'docs', 'util', 'doc.jsx');

async function start() {
    const content = await loadContent();

    try {
        await rmdir(jsonDist, { recursive: true });
    } catch{}
    await mkdir(jsonDist, { recursive: true });
    

    for (let page of content.pages) {
        let pagePath = page.hash;

        console.log('[docusarus-plugin-typedoc] Saving page data: ', pagePath);
        const fullPath = path.resolve(jsonDist, `${pagePath}.json`);
        const dirname = path.dirname(fullPath);
        const fileName = path.basename(fullPath);

        await mkdir(dirname, { recursive: true });
        await writeFile(fullPath, JSON.stringify(page, null, 4), {
            encoding: 'utf-8'
        });

        const docPath = path.resolve(basePath, 'docs', `${pagePath}.mdx`);

        let id;
        let matches = page.hash.match(/\/[^\/]+$/);
        if (matches) {
            id = matches[0].substring(1);
        } else {
            id = page.hash;
        }

        // const rendered = await renderDoc(page.contents);
        const docDirname = path.dirname(docPath);
        const relativeImportPath = createRelativePath(docDirname, fullPath);
        const relativeApiPath = createRelativePath(docDirname, apiFullPath);

        const template = await loadTemplate(page);
        const pageContents = render(template, {
            id: id,
            title: page.pageTitle ?? id,
            sidebar_label: page.pageSidebarLabel ?? id,
            description: page.pageDescription ?? `API Docs for ${id}`,
            importPath: `${relativeImportPath}`,
            apiPath: `${relativeApiPath}`,
            // html: rendered
        });

        await mkdir(docDirname, { recursive: true });

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

function createRelativePath(dirname: string, to: string) {
    const relative = path.relative(dirname, to);

    const unix = relative.replace(/\\/g, '/');

    if (!unix.startsWith('.')) { 
        return `./${unix}`;
    }

    return unix;
}

async function loadTemplate(page: Content['pages'][0]): Promise<string> {
    const templatePath = path.resolve(templatesPath, `${page.hash}.mdx`);
    try {
        const template = await readFile(templatePath, {
            encoding: 'utf-8'
        });
        return template;
    } catch (err) {
        return Template;
    }
}

start();