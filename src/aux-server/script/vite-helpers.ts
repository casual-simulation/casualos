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

export const root = path.resolve(__dirname, '..', '..', '..');
export const src = path.resolve(root, 'src');
export const nodeModules = path.resolve(root, 'node_modules');

export const auxServerDir = path.resolve(src, 'aux-server');
export const defaultPolicies = path.resolve(root, 'policies', 'default');
