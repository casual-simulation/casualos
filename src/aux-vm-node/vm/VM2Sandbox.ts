import {
    Sandbox,
    SandboxInterface,
    SandboxLibrary,
    SandboxResult,
    Transpiler,
} from '@casual-simulation/aux-common';
import { VM, VMScript } from 'vm2';

export class VM2Sandbox implements Sandbox {
    private _transpiler: Transpiler;
    private _recursionCounter: number;
    private _library: SandboxLibrary;
    private _sandbox: {
        [key: string]: any;
        __ctx__: {
            code: string;
            thisArg: any;
        };
    };
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
            __ctx__: {
                code: null,
                thisArg: null,
            },
        };

        this._script = new VMScript(`
            return (function(__code) {
                return eval(__code);
            }).call(__ctx.thisArg, __ctx.code);
        `);
        this._vm = new VM({
            sandbox: this._sandbox,
        });
    }

    run<TExtra>(
        formula: string,
        extras: TExtra,
        context: any,
        variables?: SandboxLibrary
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
            const code = this._transpiler.transpile(formula);

            for (let key in this._sandbox) {
                delete this._sandbox[key];
            }

            for (let key in this._library) {
                this._sandbox[key] = this._library[key];
            }

            if (variables) {
                for (let key in variables) {
                    this._sandbox[key] = variables[key];
                }
            }

            this._sandbox.__ctx__ = {
                code: code,
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
