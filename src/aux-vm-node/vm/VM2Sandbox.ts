import {
    Sandbox,
    SandboxInterface,
    SandboxLibrary,
    SandboxResult,
    Transpiler,
    merge,
} from '@casual-simulation/aux-common';
import { VM, VMScript } from 'vm2';
import { keys } from 'lodash';

export class VM2Sandbox implements Sandbox {
    public static DEFAULT_TIMEOUT: number = 50;

    private _transpiler: Transpiler;
    private _recursionCounter: number;
    private _library: SandboxLibrary;
    private _context: {
        code: string;
        thisArg: any;
    };
    private _finalVars: any;
    private _sandbox: any;
    private _vm: VM;
    private _script: VMScript;

    interface: SandboxInterface;

    get library(): SandboxLibrary {
        return this._library;
    }

    constructor(library: SandboxLibrary) {
        this._transpiler = new Transpiler();
        this._recursionCounter = 0;
        this._library = library;
        this._sandbox = {
            __getContext__: () => {
                return this._context;
            },
            __getVariables__: () => {
                return this._finalVars;
            },
        };

        this._script = new VMScript(`
            var __ctx__ = __getContext__();
            (function(__code) {
                let __finalVars__ = __getVariables__();
                return eval(__code);
            }).call(__ctx__.thisArg, __ctx__.code);
        `);
        this._vm = new VM({
            timeout: VM2Sandbox.DEFAULT_TIMEOUT,
            sandbox: this._sandbox,
        });
    }

    run<TExtra>(
        formula: string,
        extras: TExtra,
        context: any,
        variables: SandboxLibrary = {}
    ): SandboxResult<TExtra> {
        // This works because even though we never decrement
        // the counter we are recreating the sandbox a lot and that
        // resets the counter. Overall, this should behave as a
        // safeguard against infinite loops.
        if (this._recursionCounter > 1000) {
            return {
                success: false,
                extras: extras,
                error: new Error('Ran out of energy'),
            };
        }

        try {
            this._recursionCounter += 1;
            const js = this._transpiler.transpile(formula);

            const finalVars = merge(this._library, variables);
            this._finalVars = finalVars;
            const final =
                keys(finalVars)
                    .map(v => `var ${v} = __finalVars__["${v}"];`)
                    .join('\n') +
                '\n' +
                js;

            this._context = {
                code: final,
                thisArg: context || null,
            };
            const result = this._vm.run(this._script);

            return {
                result: result,
                error: null,
                extras: extras,
                success: true,
            };
        } catch (e) {
            return {
                success: false,
                extras: extras,
                error: e,
            };
        } finally {
            this._recursionCounter -= 1;
        }
    }
}
