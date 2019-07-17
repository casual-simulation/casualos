import { Transpiler } from './Transpiler';
import { SandboxInterface } from './SandboxInterface';
import { keys } from 'lodash';
import { merge } from '../utils';
import { SandboxLibrary, SandboxResult } from './Sandbox';

/**
 * Defines a formula sandbox that uses JavaScript's eval function to run code.
 * Not a real sandbox BTW. No security is gained from using this right now.
 */
export class EvalSandbox {
    private _transpiler: Transpiler;
    private _lib: SandboxLibrary;

    private _recursionCounter = 0;

    /**
     * The interface that the sandbox is using.
     */
    interface: SandboxInterface;

    /**
     * Gets the library that the sandbox is using.
     */
    get library() {
        return this._lib;
    }

    constructor(lib: SandboxLibrary, interface_?: SandboxInterface) {
        this._transpiler = new Transpiler();
        this._lib = lib;
        this.interface = interface_;
    }

    /**
     * Runs the given formula JavaScript and returns the result.
     * @param formula The formula to run inside the sandbox.
     * @param extras The extra data to include in the run. These extras are passed to the interface during execution.
     * @param context The object that should be mapped to "this" during execution. Enables usage of "this" inside formulas.
     */
    run<TExtra>(
        formula: string,
        extras: TExtra,
        context: any,
        variables: SandboxLibrary = {}
    ): SandboxResult<TExtra> {
        return this._runJs(formula, extras, context, variables);
    }

    private _runJs<TExtra>(
        __js: string,
        __extras: TExtra,
        __context: any,
        __variables: SandboxLibrary
    ): SandboxResult<TExtra> {
        const __this = this;

        // This works because even though we never decrement
        // the counter we are recreating the sandbox a lot and that
        // resets the counter. Overall, this should behave as a
        // safeguard against infinite loops.
        if (__this._recursionCounter > 1000) {
            return {
                success: false,
                extras: __extras,
                error: new Error('Ran out of energy'),
            };
        }

        // Using underscores to make these functions and parameters not collide
        // with other stuff the user might use.
        function _listTagValues(tag: string, filter?: (value: any) => boolean) {
            return __this.interface.listTagValues(tag, filter, __extras);
        }

        function _listObjectsWithTag(
            tag: string,
            filter?: (value: any) => boolean
        ) {
            return __this.interface.listObjectsWithTag(tag, filter, __extras);
        }

        function uuid(): string {
            return __this.interface.uuid();
        }

        function list(obj: any, context: string): any {
            return __this.interface.list(obj, context);
        }

        function __evalWrapper(js: string): any {
            const finalVars = merge(__this._lib, __variables);
            const final =
                keys(finalVars)
                    .map(v => `var ${v} = finalVars["${v}"];`)
                    .join('\n') +
                '\n' +
                js;
            return eval(final);
        }

        try {
            this._recursionCounter += 1;
            const __transpiled = this._transpile(__js);
            const result = __context
                ? __evalWrapper.call(__context, __transpiled)
                : __evalWrapper(__transpiled);
            return {
                success: true,
                extras: __extras,
                result,
            };
        } catch (e) {
            return {
                success: false,
                extras: __extras,
                error: e,
            };
        } finally {
            this._recursionCounter -= 1;
        }
    }

    private _transpile(exJs: string): string {
        return this._transpiler.transpile(exJs);
    }
}
