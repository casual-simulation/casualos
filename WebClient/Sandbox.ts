import {Transpiler} from './Transpiler';

export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

export interface SandboxInterface {
    listTagValues(tag: string, filter?: (value: any) => boolean): any;
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

    run(formula: string, extras: any) {
        const macroed = this._replaceMacros(formula);
        return this._runJs(macroed, extras);
    }

    _runJs(js: string, value: string) {
        const _this = this;

        function sum(list: any[]) {
            let carry = 0;
            list.forEach(l => {
                carry += parseFloat(l);
            });
            return carry;
        }

        function _listTagValues(tag: string, filter?: (value: any) => boolean) {
            return _this.interface.listTagValues(tag, filter);
        }

        try {
            const transpiled = this._transpile(js);
            const result = eval(transpiled);
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