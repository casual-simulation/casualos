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

import type { StoredAuxVersion1 } from '@casual-simulation/aux-common';
import { createBot, isScript } from '@casual-simulation/aux-common';
import { minifyAux } from './minify';

describe('minify', () => {
    describe('js', () => {
        it('should minify version 1 aux scripts', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@let abc = 1 + 1;
                        const b = create({
                            test: abc * 2
                        });
                        os.toast(b.id);
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);
            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);
            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('os.toast')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);
        });

        it('should support return statements', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@let abc = 1 + 1;
                        const b = create({
                            test: abc * 2
                        });
                        os.toast(b.id);
                        return b;
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);

            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);

            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('os.toast')).toBe(true);
            expect(bot.tags.onClick.includes('return')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);

            // Should add no parse directive
            expect(bot.tags.onClick.startsWith('@"-parse";')).toBe(true);
        });

        it('should support await statements', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@let abc = 1 + 1;
                        const b = create({
                            test: abc * 2
                        });
                        await os.toast(b.id);
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);

            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);

            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('await os.toast')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);

            // Should add directives
            expect(bot.tags.onClick.startsWith('@"-parse async";')).toBe(true);
        });

        it('should support await and return statements', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@let abc = 1 + 1;
                        const b = create({
                            test: abc * 2
                        });
                        await os.toast(b.id);
                        return b;
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);

            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);

            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('await os.toast')).toBe(true);
            expect(bot.tags.onClick.includes('return')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);

            // Should add directives
            expect(bot.tags.onClick.startsWith('@"-parse async";')).toBe(true);
        });

        it('should support import statements', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@
                        import func from "some-module";
                        let abc = 1 + 1;
                        const b = create({
                            test: func(abc * 2)
                        });
                        await os.toast(b.id);
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);

            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);

            expect(bot.tags.onClick.includes('__importModule(')).toBe(true);
            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('await os.toast')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);

            // Should add directives
            expect(bot.tags.onClick.startsWith('@"-parse async module";')).toBe(
                true
            );
        });

        it('should support import and return statements', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        onClick: `@
                        import func from "some-module";
                        let abc = 1 + 1;
                        const b = create({
                            test: func(abc * 2)
                        });
                        await os.toast(b.id);
                        return b;
                        `,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(isScript(bot.tags.onClick)).toBe(true);

            expect(bot.tags.onClick !== aux.state.test1.tags.onClick).toBe(
                true
            );
            expect(
                bot.tags.onClick.length < aux.state.test1.tags.onClick.length
            ).toBe(true);

            expect(bot.tags.onClick.includes('__importModule(')).toBe(true);
            expect(bot.tags.onClick.includes('create(')).toBe(true);
            expect(bot.tags.onClick.includes('await os.toast')).toBe(true);
            expect(bot.tags.onClick.includes('return')).toBe(true);

            // Should not include an extra newline at the end
            expect(bot.tags.onClick.endsWith('\n')).toBe(false);

            // Should add directives
            expect(bot.tags.onClick.startsWith('@"-parse async module";')).toBe(
                true
            );
        });
    });

    describe('css', () => {
        it('should minify css', async () => {
            const aux: StoredAuxVersion1 = {
                version: 1,
                state: {
                    test1: createBot('test1', {
                        'abc.css': `.my-class {
                            color: red;
                            margin: 10px;   
                        }`,
                    }),
                },
            };

            const minified = (await minifyAux(
                aux,
                'chrome100'
            )) as StoredAuxVersion1;

            expect(minified.version).toBe(1);
            expect(Object.keys(minified.state)).toEqual(['test1']);

            const bot = minified.state['test1'];
            expect(
                bot.tags['abc.css'] !== aux.state.test1.tags['abc.css']
            ).toBe(true);
            expect(
                bot.tags['abc.css'].length <
                    aux.state.test1.tags['abc.css'].length
            ).toBe(true);
        });
    });
});
