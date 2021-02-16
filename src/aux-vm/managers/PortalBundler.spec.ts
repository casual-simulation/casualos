import {
    createBot,
    createPrecalculatedBot,
    OpenCustomPortalOptions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import {
    DEFAULT_BASE_MODULE_URL,
    ESBuildPortalBundler,
    PortalBundler,
    ScriptPrefix,
} from './PortalBundler';

console.log = jest.fn();
jest.mock('axios');

describe('ESBuildPortalBundler', () => {
    let bundler: PortalBundler;

    describe('bundleTag()', () => {
        let func1: jest.Mock<any>;
        let func2: jest.Mock<any>;

        beforeEach(() => {
            bundler = new ESBuildPortalBundler();
            (<any>globalThis).func1 = func1 = jest.fn();
            (<any>globalThis).func2 = func2 = jest.fn();
        });

        afterEach(() => {
            delete (<any>globalThis).func2;
            delete (<any>globalThis).func1;
        });

        const prefixCases: [string, string[], string, string][] = [
            ['library emoji', ['📖'], '📖', '📖'],
            ['smile emoji', ['🙂'], '🙂', '🙂'],
            ['multiple emoji', ['📖', '🙂'], '🙂', '📖'],
        ];

        describe.each(prefixCases)(
            '%s',
            (desc, scriptPrefixes, firstPrefix, secondPrefix) => {
                let prefixes: ScriptPrefix[];

                beforeEach(() => {
                    prefixes = [
                        {
                            prefix: firstPrefix,
                            language: 'javascript',
                        },
                        {
                            prefix: secondPrefix,
                            language: 'javascript',
                        },
                    ];
                });

                it('should resolve with null if there are no tags with the right prefix', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `console.log("abc")`,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `console.log("def")`,
                        }),
                    };
                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).toEqual(null);
                });

                it('should resolve with a bundle that contains the specified tags', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("abc")`,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `${secondPrefix}console.log("def")`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();
                    expect(bundle).toMatchSnapshot();
                });

                it('should resolve with build errors', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("ab`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.error).toBeTruthy();
                    expect(bundle).toMatchSnapshot();
                });

                it('should execute entry points in bot ID alphabetical order', async () => {
                    const state = {
                        def: createPrecalculatedBot('def', {
                            main: `${firstPrefix}globalThis.func1("second");`,
                        }),
                        abc: createPrecalculatedBot('abc', {
                            main: `${secondPrefix}globalThis.func1("first");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'first');
                    expect(func1).toHaveBeenNthCalledWith(2, 'second');
                });

                it('should be able to import scripts from other tags', async () => {
                    const state = {
                        abc: createPrecalculatedBot('abc', {
                            main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                            other: `${secondPrefix}globalThis.func1("other");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'other');
                    expect(func1).toHaveBeenNthCalledWith(2, 'main');
                });

                it('should handle modules that reference each other', async () => {
                    const state = {
                        abc: createPrecalculatedBot('abc', {
                            main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                            other: `${secondPrefix}import "${firstPrefix}main"; globalThis.func1("other");`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.source).toBeTruthy();

                    eval(bundle.source);

                    expect(func1).toBeCalledTimes(2);
                    expect(func1).toHaveBeenNthCalledWith(1, 'other');
                    expect(func1).toHaveBeenNthCalledWith(2, 'main');
                });

                it('should report which bots and tags are included in the bundle', async () => {
                    const state = {
                        bot1: createPrecalculatedBot('bot1', {
                            main: `${firstPrefix}console.log("abc")`,
                            different: true,
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: `${secondPrefix}import "${secondPrefix}second"; console.log("def")`,
                            second: `${secondPrefix}let test = 123;`,
                        }),
                        bot3: createPrecalculatedBot('bot3', {
                            main: `no prefix`,
                        }),
                        bot4: createPrecalculatedBot('bot4', {
                            other: `no prefix`,
                        }),
                    };

                    const bundle = await bundler.bundleTag(
                        state,
                        'main',
                        prefixes
                    );

                    expect(bundle).not.toEqual(null);
                    expect(bundle.modules).toEqual({
                        bot1: new Set(['main']),
                        bot2: new Set(['main', 'second']),
                    });
                });

                describe('imports', () => {
                    beforeEach(() => {
                        require('axios').__reset();
                    });

                    it('should try to load modules from skypack', async () => {
                        require('axios').__setResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        await waitAsync();

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let [url] = require('axios').__getLastGet();

                        expect(url).toBe(
                            `${DEFAULT_BASE_MODULE_URL}/lodash?dts`
                        );

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should report errors that occur while fetching data', async () => {
                        require('axios').__setFail(true);

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.error).toBeTruthy();
                        expect(bundle.error).toMatchSnapshot();
                    });

                    it('should support HTTPS modules that have relative references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './fun';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have parent references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './first.js';`,
                            })
                            .__setNextResponse({
                                data: `export * from '../nested/fun.js';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash/test/haha.js"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/test/haha.js?dts`,
                            ],
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/test/first.js`,
                            ],
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/nested/fun.js`,
                            ],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have deep parent references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './first.js';`,
                            })
                            .__setNextResponse({
                                data: `export * from '../../nested/fun.js';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash/test/haha.js"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();
                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/test/haha.js?dts`,
                            ],
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/test/first.js`,
                            ],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/nested/fun.js`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have absolute references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from '/fun';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/fun`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should support HTTPS modules that have nested references', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export * from './fun';`,
                            })
                            .__setNextResponse({
                                data: `export * from './other';`,
                            })
                            .__setNextResponse({
                                data: `export * from '/final';`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        expect(bundle).not.toEqual(null);
                        expect(bundle.source).toBeTruthy();

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                            [
                                'get',
                                `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`,
                            ],
                            ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                        ]);

                        eval(bundle.source);

                        expect(func1).toBeCalledTimes(1);
                    });

                    it('should cache HTTP modules across builds', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func2;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle1 = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );
                        const bundle2 = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                        ]);
                        expect(bundle1).toEqual(bundle2);
                    });

                    it('should cache HTTP modules that are requested concurrently', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func2;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const [bundle1, bundle2] = await Promise.all([
                            bundler.bundleTag(state, 'main', prefixes),
                            bundler.bundleTag(state, 'main', prefixes),
                        ]);

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                        ]);
                        expect(bundle1).toEqual(bundle2);
                    });

                    it('should report external modules that were imported', async () => {
                        require('axios').__setResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        await waitAsync();

                        expect(bundle).not.toEqual(null);
                        expect(bundle.externals).toEqual({
                            lodash: {
                                id: 'lodash',
                                url: `${DEFAULT_BASE_MODULE_URL}/lodash?dts`,
                                typescriptDefinitionsURL: null,
                            },
                        });
                    });

                    it('should report typescript definitions that were returned from the server', async () => {
                        require('axios').__setResponse({
                            data: `export const fun = globalThis.func1;`,
                            headers: {
                                'x-typescript-types': '/typescriptDefinitions',
                            },
                        });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const bundle = await bundler.bundleTag(
                            state,
                            'main',
                            prefixes
                        );

                        await waitAsync();

                        expect(bundle).not.toEqual(null);
                        expect(bundle.externals).toEqual({
                            lodash: {
                                id: 'lodash',
                                url: `${DEFAULT_BASE_MODULE_URL}/lodash?dts`,
                                typescriptDefinitionsURL: `${DEFAULT_BASE_MODULE_URL}/typescriptDefinitions`,
                            },
                        });
                    });

                    it('should report typescript definitions for cached modules', async () => {
                        require('axios')
                            .__setNextResponse({
                                data: `export const fun = globalThis.func1;`,
                                headers: {
                                    'x-typescript-types':
                                        '/typescriptDefinitions',
                                },
                            })
                            .__setNextResponse({
                                data: `export const fun = globalThis.func2;`,
                            });

                        const state = {
                            bot1: createPrecalculatedBot('bot1', {
                                main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                            }),
                        };

                        const [bundle1, bundle2] = await Promise.all([
                            bundler.bundleTag(state, 'main', prefixes),
                            bundler.bundleTag(state, 'main', prefixes),
                        ]);

                        let requests = require('axios').__getRequests();

                        expect(requests).toEqual([
                            ['get', `${DEFAULT_BASE_MODULE_URL}/lodash?dts`],
                        ]);
                        expect(bundle1.externals).toEqual({
                            lodash: {
                                id: 'lodash',
                                url: `${DEFAULT_BASE_MODULE_URL}/lodash?dts`,
                                typescriptDefinitionsURL: `${DEFAULT_BASE_MODULE_URL}/typescriptDefinitions`,
                            },
                        });
                        expect(bundle1).toEqual(bundle2);
                    });
                });
            }
        );

        it('should support typescript', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let abc: string = "Hello!";`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'typescript',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support JSON', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖{ "abc": "def" }`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'json',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support JSX', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let element = (<h1>Hello!</h1>);`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'jsx',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support TSX', async () => {
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖let element: any = (<h1>Hello!</h1>);`,
                }),
            };

            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'tsx',
                },
            ]);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();
            expect(bundle).toMatchSnapshot();
        });

        it('should support prefixes in the given tag name', async () => {
            const prefixes: ScriptPrefix[] = [
                {
                    prefix: '🔺',
                    language: 'javascript',
                },
                {
                    prefix: '📖',
                    language: 'javascript',
                },
            ];
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `🔺globalThis.func1("first");`,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    main: `📖globalThis.func1("second");`,
                }),
            };

            const bundle = await bundler.bundleTag(state, `🔺main`, prefixes);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toBeCalledTimes(1);
            expect(func1).toBeCalledWith('first');
        });

        it('should support importing separate prefixes from special entry prefixes', async () => {
            const prefixes: ScriptPrefix[] = [
                {
                    prefix: '🔺',
                    language: 'javascript',
                },
                {
                    prefix: '📖',
                    language: 'javascript',
                },
            ];
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `🔺import "📖main"; globalThis.func1("first");`,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    main: `📖globalThis.func1("second");`,
                }),
            };

            const bundle = await bundler.bundleTag(state, `🔺main`, prefixes);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toBeCalledTimes(2);
            expect(func1).toHaveBeenNthCalledWith(1, 'second');
            expect(func1).toHaveBeenNthCalledWith(2, 'first');
        });

        it('should support importing arbitrary values using a fallback prefix', async () => {
            const prefixes: ScriptPrefix[] = [
                {
                    prefix: '🔺',
                    language: 'javascript',
                },
                {
                    prefix: '#',
                    language: 'text',
                    isFallback: true,
                },
            ];
            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `🔺import abc from "#other"; globalThis.func1(abc);`,
                }),
                bot2: createPrecalculatedBot('bot2', {
                    other: `test`,
                }),
            };

            const bundle = await bundler.bundleTag(state, `🔺main`, prefixes);

            expect(bundle).not.toEqual(null);
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toBeCalledTimes(1);
            expect(func1).toBeCalledWith('test');
        });
    });

    describe('addLibrary()', () => {
        let func1: jest.Mock<any>;
        let func2: jest.Mock<any>;

        beforeEach(() => {
            require('axios').__reset();
            bundler = new ESBuildPortalBundler();
            (<any>globalThis).func1 = func1 = jest.fn();
            (<any>globalThis).func2 = func2 = jest.fn();
        });

        afterEach(() => {
            delete (<any>globalThis).func2;
            delete (<any>globalThis).func1;
        });

        it('should use the given source when importing the specified library', async () => {
            bundler.addLibrary({
                id: 'casualos',
                source: 'globalThis.func1("casualos");',
                language: 'javascript',
            });

            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖import "casualos"; globalThis.func1("main");`,
                }),
            };
            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'typescript',
                },
            ]);

            expect(bundle).toMatchSnapshot();
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toHaveBeenCalledTimes(2);
            expect(func1).toHaveBeenNthCalledWith(1, 'casualos');
            expect(func1).toHaveBeenNthCalledWith(2, 'main');
        });

        it('should be able to process imports from libraries', async () => {
            require('axios').__setResponse({
                data: `export const fun = globalThis.func1;`,
            });

            bundler.addLibrary({
                id: 'casualos',
                source: 'export * from "lodash";',
                language: 'javascript',
            });

            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖import { fun } from "casualos"; fun("main");`,
                }),
            };
            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'typescript',
                },
            ]);

            expect(bundle).toMatchSnapshot();
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toHaveBeenCalledTimes(1);
            expect(func1).toHaveBeenNthCalledWith(1, 'main');
        });

        it('should only override imports that exactly match the library name', async () => {
            bundler.addLibrary({
                id: 'rxjs',
                source: 'globalThis.func1("rxjs");',
                language: 'javascript',
            });

            bundler.addLibrary({
                id: 'rxjs/operators',
                source: 'globalThis.func1("rxjs/operators");',
                language: 'javascript',
            });

            const state = {
                bot1: createPrecalculatedBot('bot1', {
                    main: `📖import "rxjs/operators"; globalThis.func1("main");`,
                }),
            };
            const bundle = await bundler.bundleTag(state, 'main', [
                {
                    prefix: '📖',
                    language: 'typescript',
                },
            ]);

            expect(bundle).toMatchSnapshot();
            expect(bundle.source).toBeTruthy();

            eval(bundle.source);

            expect(func1).toHaveBeenCalledTimes(2);
            expect(func1).toHaveBeenNthCalledWith(1, 'rxjs/operators');
            expect(func1).toHaveBeenNthCalledWith(2, 'main');
        });
    });
});
