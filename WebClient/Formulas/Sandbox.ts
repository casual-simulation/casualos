import {Transpiler} from './Transpiler';
import lib from 'formula-lib';

export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

export type FilterFunction = (value: any) => boolean;

export interface SandboxInterface {
    listTagValues(tag: string, filter?: FilterFunction, extras?: any): any;
    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any): any;
}

export interface SandboxResult<TExtra> {
    success: boolean;
    extras: TExtra;
    result?: any;
    error?: Error;
}

/**
 * Not a real sandbox BTW. No security is gained from using this right now.
 */
export class Sandbox {
    private _transpiler: Transpiler;

    macros: SandboxMacro[] = [
        {
            test: /^\=/g,
            replacement: (val) => ''
        }
    ];
    interface: SandboxInterface;

    constructor(interface_: SandboxInterface) {
        this._transpiler = new Transpiler();
        this.interface = interface_;
    }

    run<TExtra>(formula: string, extras: TExtra, context: any) : SandboxResult<TExtra> {
        const macroed = this._replaceMacros(formula);
        return this._runJs(macroed, extras, context);
    }

    _runJs<TExtra>(__js: string, __extras: TExtra, __context: any): SandboxResult<TExtra> {
        const __this = this;

        // Using underscores to make these functions and parameters not collide
        // with other stuff the user might use.
        function _listTagValues(tag: string, filter?: (value: any) => boolean) {
            return __this.interface.listTagValues(tag, filter, __extras);
        }

        function _listObjectsWithTag(tag: string, filter?: (value: any) => boolean) {
            return __this.interface.listObjectsWithTag(tag, filter, __extras);
        }

        function __evalWrapper(js: string): any {
            const final = lib + js;
            return eval(final);
        }

        try {
            const __transpiled = this._transpile(__js);
            const result = __context ? __evalWrapper.call(__context, __transpiled) : __evalWrapper(__js);
            return {
                success: true,
                extras: __extras,
                result
            };
        } catch(e) {
            console.warn(e);
            return {
                success: false,
                extras: __extras,
                error: e
            };
        }
    }

    _transpile(exJs: string): string {
        return this._transpiler.transpile(exJs);
    }

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