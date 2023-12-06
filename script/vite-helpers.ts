import path from 'path';
import fs from 'fs';
import type { Plugin } from 'rollup';

export function generateDependencyGraphRollupPlugin(
    distFolder: string
): Plugin {
    if (!distFolder) {
        throw new Error('You must specify a dist folder');
    }
    return {
        name: 'casualos:generate_dependency_graph',
        buildEnd() {
            const deps = [] as any[];
            for (const id of this.getModuleIds()) {
                const m = this.getModuleInfo(id);
                if (m != null && !m.isExternal) {
                    for (const target of m.importedIds) {
                        deps.push({ source: m.id, target });
                    }
                }
            }

            fs.mkdirSync(distFolder, { recursive: true });

            fs.writeFileSync(
                path.join(distFolder, 'dependency-graph.json'),
                JSON.stringify(deps, null, 2)
            );
        },
    };
}

export const root = path.resolve(__dirname, '..');
export const src = path.resolve(root, 'src');
export const nodeModules = path.resolve(root, 'node_modules');

export const auxServerDir = path.resolve(src, 'aux-server');
export const defaultPolicies = path.resolve(root, 'policies', 'default');
