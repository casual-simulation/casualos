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

// Copyright (c) 2021 Thomas Schaaf

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import fastGlob from 'fast-glob';

const EsbuildPluginImportGlob = () => ({
    name: 'require-context',
    setup: (build) => {
        build.onResolve({ filter: /\*/ }, async (args) => {
            if (args.resolveDir === '') {
                return; // Ignore unresolvable paths
            }

            return {
                path: args.path,
                namespace: 'import-glob',
                pluginData: {
                    resolveDir: args.resolveDir,
                },
            };
        });

        build.onLoad(
            { filter: /.*/, namespace: 'import-glob' },
            async (args) => {
                const files = (
                    await fastGlob(args.path, {
                        cwd: args.pluginData.resolveDir,
                        ignore: ['**/node_modules/**'],
                        onlyFiles: true,
                    })
                ).sort();

                let importerCode = `
        ${files
            .map(
                (module, index) => `import * as module${index} from '${module}'`
            )
            .join(';')}

        const modules = [${files
            .map((module, index) => `module${index}`)
            .join(',')}];

        export default modules;
        export const filenames = [${files
            .map((module, index) => `'${module}'`)
            .join(',')}]
      `;

                return {
                    contents: importerCode,
                    resolveDir: args.pluginData.resolveDir,
                };
            }
        );
    },
});

export default EsbuildPluginImportGlob;
