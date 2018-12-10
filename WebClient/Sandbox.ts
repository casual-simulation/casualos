
export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

export class Sandbox {
    macros: SandboxMacro[] = [];
    eval: (js: string, extras: any) => any;

    constructor(evalFunc: (js: string, extras: any) => any) {
        this.eval = evalFunc;
    }

    run(formula: string, extras: any) {
        const macroed = this._replaceMacros(formula);
        return this.eval(macroed, extras);
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