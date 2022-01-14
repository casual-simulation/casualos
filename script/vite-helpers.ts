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
            const deps = [];
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
