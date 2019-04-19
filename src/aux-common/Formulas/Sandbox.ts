import { Transpiler } from './Transpiler';
import SandboxInterface from './SandboxInterface';
import { keys } from 'lodash';
import { merge } from '../utils';

export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

/**
 * Defines an interface for objects that represent the result of a calculation from the sandbox.
 */
export interface SandboxResult<TExtra> {
    /**
     * Whether the calculation was successful.
     */
    success: boolean;
    /**
     * The extra data that was passed to the sandbox.
     */
    extras: TExtra;
    /**
     * The result of the sandbox calculation, if any.
     */
    result?: any;
    /**
     * The error that happened inside the sandbox, if any.
     */
    error?: Error;
}

/**
 * Defines an interface for an object that contains a set of variables
 * to inject into a sandbox.
 */
export interface SandboxLibrary {
    [key: string]: any;
}

/**
 * Not a real sandbox BTW. No security is gained from using this right now.
 */
export class Sandbox {
    private _transpiler: Transpiler;
    private _lib: SandboxLibrary;

    private _recursionCounter = 0;

    /**
     * The list of macros that the sandbox uses on the input code before transpiling it.
     */
    macros: SandboxMacro[] = [
        {
            test: /^(?:\=|\:\=)/g,
            replacement: val => '',
        },
    ];

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
        const macroed = this._replaceMacros(formula);
        return this._runJs(macroed, extras, context, variables);
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
        if (__this._recursionCounter > 100) {
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
                : __evalWrapper(__js);
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
        }
    }

    private _transpile(exJs: string): string {
        return this._transpiler.transpile(exJs);
    }

    /**
     * Adds the given macro to the list of macros that are run on the code
     * before execution.
     */
    addMacro(macro: SandboxMacro) {
        this.macros.push(macro);
    }

    private _replaceMacros(formula: string) {
        if (!formula) {
            return formula;
        }
        this.macros.forEach(m => {
            formula = formula.replace(m.test, m.replacement);
        });

        return formula;
    }
}
