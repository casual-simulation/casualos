import {Transpiler} from './Transpiler';

export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

export type FilterFunction = (value: any) => boolean;

export interface SandboxInterface {
    listTagValues(tag: string, filter?: FilterFunction): any;
    listObjectsWithTag(tag: string, filter?: FilterFunction): any;
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

    run(formula: string, extras: any, context: any) {
        const macroed = this._replaceMacros(formula);
        return this._runJs(macroed, extras, context);
    }

    _runJs(js: string, value: string, context: any) {
        const _this = this;

        function sum(list: any) {
            if(!Array.isArray(list)) {
                return parseFloat(list);
            }

            let carry = 0;
            for (let i = 0; i < list.length; i++) {
                const l = list[i];
                if (!Array.isArray(l)) {
                    carry += parseFloat(l);
                } else {
                    carry += sum(l);
                }
            }
            return carry;
        }

        function avg(list: any[]) {
            let total = sum(list);
            let count = list.length;
            return total/count;
        }

        function _listTagValues(tag: string, filter?: (value: any) => boolean) {
            return _this.interface.listTagValues(tag, filter);
        }

        function _listObjectsWithTag(tag: string, filter?: (value: any) => boolean) {
            return _this.interface.listObjectsWithTag(tag, filter);
        }

        function evalWrapper(js: string): any {
            return eval(js);
        }

        try {
            const transpiled = this._transpile(js);
            const result = context ? evalWrapper.call(context, transpiled) : evalWrapper(js);
            return result;
        } catch(e) {
            console.warn(e);
            return value;
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