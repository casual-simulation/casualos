import { Transpiler } from '../Formulas/Transpiler';
import { isFormula, isScript, parseScript } from '../bots';

/**
 * Defines a class that can compile scripts and formulas
 * into functions.
 */
export class AuxCompiler {
    private _transpiler = new Transpiler();

    /**
     * Compiles the given script into a function.
     * @param script The script to compile.
     * @param options The options that should be used to compile the script.
     */
    compile(script: string, options?: AuxCompileOptions): AuxCompiledScript {
        let { func, scriptLineOffset } = this._compileFunction(
            script,
            options || {}
        );

        const scriptFunction = func;

        if (options) {
            if (options.before || options.after) {
                const before = options.before || (() => {});
                const after = options.after || (() => {});

                const scriptFunc = func;
                const context = options.context;
                func = function(...args: any[]) {
                    before(context);
                    try {
                        return scriptFunc(...args);
                    } finally {
                        after(context);
                    }
                };
            }
        }

        const final = func as AuxCompiledScript;
        final.metadata = {
            scriptFunction,
            scriptLineOffset,
        };

        return final;
    }

    private _parseScript(script: string): string {
        return script;
    }

    private _compileFunction(
        script: string,
        options: AuxCompileOptions
    ): {
        func: Function;
        scriptLineOffset: number;
    } {
        // Yes this code is super ugly.
        // Some day we will engineer this into a real
        // compiler, but for now this ad-hoc method
        // seems to work.

        let formula = false;
        if (isFormula(script)) {
            script = script.substring(1);
            formula = true;
        } else if (isScript(script)) {
            script = parseScript(script);
        }
        script = this._parseScript(script);
        let scriptLineOffset = 0;

        let constantsCode = '';
        if (options.constants) {
            const lines = Object.keys(options.constants)
                .filter(v => v !== 'this')
                .map(v => `const ${v} = constants["${v}"];`);
            constantsCode = lines.join('\n') + '\n';
        }

        let variablesCode = '';
        if (options.variables) {
            const lines = Object.keys(options.variables)
                .filter(v => v !== 'this')
                .map(v => `const ${v} = variables["${v}"](context);`);
            variablesCode = '\n' + lines.join('\n');
            scriptLineOffset += 1 + (lines.length - 1);
        }

        let scriptCode: string;
        if (formula) {
            scriptCode = `\nreturn eval(_script)`;
        } else {
            scriptCode = `\n { \n${script}\n }`;
            scriptLineOffset += 2;
        }

        // Function needs a name because acorn doesn't understand
        // that this function is allowed to be anonymous.
        const functionCode = `function _() { ${variablesCode}${scriptCode}\n }`;
        const transpiled = this._transpiler.transpile(functionCode);

        const finalCode = `${constantsCode}return ${transpiled};`;

        let func = _buildFunction(finalCode, options, formula ? script : null);

        if (options.variables) {
            if ('this' in options.variables) {
                func = func.bind(options.variables['this'](options.context));
            }
        }

        return { func, scriptLineOffset };
    }
}

function _buildFunction(
    finalCode: string,
    options: AuxCompileOptions,
    script?: string
) {
    if (script) {
        return Function(
            'constants',
            'variables',
            'context',
            '_script',
            finalCode
        )(options.constants, options.variables, options.context, script);
    } else {
        return Function('constants', 'variables', 'context', finalCode)(
            options.constants,
            options.variables,
            options.context
        );
    }
}

/**
 * A script that has been compiled.
 */
export interface AuxCompiledScript {
    (...args: any[]): any;

    /**
     * The metadata for the script.
     */
    metadata: AuxScriptMetadata;
}

/**
 * Metadata about the script.
 */
export interface AuxScriptMetadata {
    /**
     * The function that directly wraps the script.
     */
    scriptFunction: Function;

    /**
     * The number of lines that the user's script is offset inside the returned function source.
     */
    scriptLineOffset: number;
}

/**
 * The set of options that a script should be compiled with.
 */
export interface AuxCompileOptions {
    /**
     * The context that should be used.
     */
    context?: any;

    /**
     * The variables that should be made available to the script.
     */
    variables?: {
        [name: string]: (context?: any) => any;
    };

    /**
     * The constant values that should be made available to the script.
     */
    constants?: {
        [name: string]: any;
    };

    /**
     * A function that should be called before the compiled function is executed.
     */
    before?: Function;

    /**
     * A function that should be called after the compiled function is executed.
     */
    after?: Function;
}
