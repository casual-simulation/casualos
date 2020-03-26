/**
 * Defines a class that can compile scripts and formulas
 * into functions.
 */
export class AuxCompiler {
    /**
     * Compiles the given script into a function.
     * @param script The script to compile.
     * @param options The options that should be used to compile the script.
     */
    compile(script: string, options?: AuxCompileOptions): AuxCompiledScript {
        let { func, scriptLineOffset } = this._compileFunction(script, options);

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

    private _compileFunction(
        script: string,
        options?: AuxCompileOptions
    ): {
        func: Function;
        scriptLineOffset: number;
    } {
        let scriptLineOffset = 0;
        if (options) {
            let constantsCode = '';
            if (options.constants) {
                const lines = Object.keys(options.constants)
                    .filter(v => v !== 'this')
                    .map(v => `const ${v} = constants["${v}"];`);
                constantsCode = '\n' + lines.join('\n');
                scriptLineOffset += 1 + lines.length;
            }

            let variablesCode = '';
            if (options.variables) {
                const lines = Object.keys(options.variables)
                    .filter(v => v !== 'this')
                    .map(v => `const ${v} = variables["${v}"](context);`);
                variablesCode = '\n' + lines.join('\n');
                scriptLineOffset += 1 + lines.length;
            }

            const scriptCode = `\n { \n${script}\n }`;
            scriptLineOffset += 1;
            const functionCode = `function() { ${constantsCode}${variablesCode}${scriptCode}\n }`;

            const finalCode = `return ${functionCode};`;

            let func = Function('constants', 'variables', 'context', finalCode)(
                options.constants,
                options.variables,
                options.context
            );

            if (options.variables) {
                if ('this' in options.variables) {
                    func = func.bind(
                        options.variables['this'](options.context)
                    );
                }
            }

            return { func, scriptLineOffset };
        }

        return {
            func: Function(script),
            scriptLineOffset,
        };
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
