import {
    Agent,
    ManagedRealm,
    setSurroundingAgent,
    OrdinaryObjectCreate,
    CreateDataProperty,
    Value,
    Type,
    inspect,
    CreateBuiltinFunction,
    JSStringValue,
    BigIntValue,
    BooleanValue,
    NumberValue,
    SymbolValue,
    ObjectValue,
    SameValue,
    Get,
    ModuleEntry,
    SourceTextModuleRecord,
    MakeBasicObject,
    Completion,
    ThrowCompletion,
    Construct,
    NormalCompletion,
    Set,
    EnsureCompletion,
    Call,
    ExecutionContextStack,
    isECMAScriptFunctionObject,
    ECMAScriptNode,
    Expression,
    Statement,
    Realm,
    Invoke,
} from '@casual-simulation/engine262';
import { EvaluationYield } from '@casual-simulation/engine262/types/evaluator';
import ErrorStackParser from '@casual-simulation/error-stack-parser';
import StackFrame from 'stackframe';
import { unwind } from './InterpreterUtils';

const builtinConstructors = [
    [
        '%Promise.prototype%',
        Promise.prototype,
        (val: Value, interpreter: Interpreter) => {
            return new Promise((resolve, reject) => {
                const bResolve = CreateBuiltinFunction(
                    (args: any[]) => {
                        const val = args[0];
                        resolve(interpreter.copyFromValue(val));
                        return Value.undefined;
                    },
                    1,
                    new Value('resolve'),
                    [],
                    interpreter.realm
                );

                const bReject = CreateBuiltinFunction(
                    (args: any[]) => {
                        const val = args[0];
                        reject(interpreter.copyFromValue(val));
                        return Value.undefined;
                    },
                    1,
                    new Value('reject'),
                    [],
                    interpreter.realm
                );

                unwind(
                    Invoke(val as ObjectValue, new Value('then'), [
                        bResolve,
                        bReject,
                    ])
                );
            });
        },
        (val: Promise<any>, interpreter: Interpreter) => {
            const executer = CreateBuiltinFunction(
                (args: any[]) => {
                    const [resolve, reject] = args;

                    val.then(
                        (res) => {
                            let result = interpreter.copyToValue(res);
                            if (result.Type !== 'normal') {
                                unwind(
                                    Call(reject, Value.null, [result.Value])
                                );
                            } else {
                                unwind(
                                    Call(resolve, Value.null, [result.Value])
                                );
                            }
                        },
                        (err) => {
                            let result = interpreter.copyToValue(err);
                            unwind(Call(reject, Value.null, [result.Value]));
                        }
                    );
                },
                2,
                new Value('executer'),
                [],
                interpreter.realm
            );
            return EnsureCompletion(
                unwind(
                    Construct(
                        interpreter.realm.Intrinsics[
                            '%Promise%'
                        ] as ObjectValue,
                        [executer]
                    )
                )
            );
        },
    ] as const,
];

const builtinPrototypes = [
    ['%Object.prototype%', Object.prototype] as const,
    ['%Promise.prototype%', Promise.prototype] as const,
    ['%Error.prototype%', Error.prototype] as const,
    ['%EvalError.prototype%', EvalError.prototype] as const,
    ['%RangeError.prototype%', RangeError.prototype] as const,
    ['%ReferenceError.prototype%', ReferenceError.prototype] as const,
    ['%SyntaxError.prototype%', SyntaxError.prototype] as const,
    ['%TypeError.prototype%', TypeError.prototype] as const,
    ['%URIError.prototype%', URIError.prototype] as const,
];

export type PossibleBreakpointStates =
    | ['before' | 'after']
    | ['before', 'after'];

const POSSIBLE_BREAKPOINT_LOCATIONS: {
    [key: string]: PossibleBreakpointStates;
} = {
    CallExpression: ['before', 'after'],
    AssignmentExpression: ['before', 'after'],
    LexicalDeclaration: ['after'],
    VariableStatement: ['after'],
    IfStatement: ['before'],
    SwitchStatement: ['before'],
    ReturnStatement: ['before', 'after'],
    AdditiveExpression: ['before', 'after'],
    MultiplicativeExpression: ['before', 'after'],
    BitwiseANDExpression: ['before', 'after'],
    BitwiseORExpression: ['before', 'after'],
    BitwiseXORExpression: ['before', 'after'],
};

const NESTED_BREAKPOINTS: {
    [key: string]: [string, string][];
} = {
    IfStatement: [['Statement_b', 'Block']],
};

/**
 * Defines a class that wraps common engine262 capabilities.
 */
export class Interpreter {
    private _valueSymbolMap = new Map<Value, symbol>();
    private _realSymbolMap = new Map<symbol, SymbolValue>();
    private _debugging: boolean;
    private _breakpoints: Breakpoint[] = [];

    /**
     * The agent that this interpreter is currently using.
     */
    agent: Agent;

    /**
     * The realm that this interpreter is using.
     */
    realm: ManagedRealm;

    /**
     * Gets whether this interpreter is currently debugging.
     */
    get debugging() {
        return this._debugging;
    }

    /**
     * Sets whether this interpreter is debugging.
     */
    set debugging(value: boolean) {
        this._debugging = value;
        this.agent.hostDefinedOptions.yieldEachNode = value;
    }

    constructor() {
        this.agent = new Agent({});
        setSurroundingAgent(this.agent);
        this.realm = new ManagedRealm({});

        this._setupGlobals();
    }

    /**
     * Creates a new ES6 module using the given code and name.
     * @param moduleCode The code that the module is made up of.
     * @param moduleId The ID of the module.
     * @returns Returns the created module.
     */
    createAndLinkModule(moduleCode: string, moduleId: string) {
        const record = this.realm.createSourceTextModule(moduleId, moduleCode);

        if ('Type' in record) {
            throw this.copyFromValue(record.Value);
        }

        this.realm.scope(() => {
            let result = record.Link();

            expect(result).toBe(Value.undefined);
            expect(record).toBeDefined();

            result = record.EvaluateAndUnwind();
        });

        return record;
    }

    /**
     * Creates a new function in the global scope using the given function name, function code, and parameters names.
     * @param functionName The name of the function.
     * @param functionCode The code for the body of the function.
     * @param paramNames The names of the parameters.
     */
    createFunction(
        functionName: string,
        functionCode: string,
        ...paramNames: string[]
    ): ConstructedFunction {
        const code = `export function ${functionName}(${paramNames.join(
            ','
        )}) {\n${functionCode}\n}`;

        try {
            const module = this.createAndLinkModule(code, functionName);
            const func = module.Environment.GetBindingValue(
                new Value(functionName),
                Value.true
            );

            return {
                module,
                func: func as ObjectValue,
                name: functionName,
            };
        } catch (err) {
            if (err instanceof SyntaxError) {
                let newStack = mapErrorLineNumbers(
                    err,
                    (lineNumber, fileName, funcName) =>
                        fileName === functionName || funcName === functionName
                            ? lineNumber - 1
                            : lineNumber
                );
                (err as any).oldStack = err.stack;
                err.stack = newStack;
            }

            throw err;
        }
    }

    /**
     * Calls the given function
     * @param func The function that should be called.
     * @param args The arguments that should be provided to the function.
     */
    *callFunction(
        func: ConstructedFunction,
        ...args: any[]
    ): Generator<InterpreterStop, any, InterpreterContinuation> {
        let a = args.map((a) => {
            const result = this.copyToValue(a);
            if (result.Type !== 'normal') {
                throw this.copyFromValue(result.Value);
            }
            return result.Value;
        });

        let generator = Call(func.func, Value.null, a);

        let result: Completion<Value>;
        while (true) {
            let { done, value } = generator.next();

            if (done) {
                result = value as Completion<Value>;
                break;
            } else if (this.debugging) {
                const step = value as EvaluationYield;
                const possibleLocations =
                    POSSIBLE_BREAKPOINT_LOCATIONS[step.node.type];
                if (
                    !possibleLocations ||
                    !possibleLocations.includes(step.evaluationState)
                ) {
                    continue;
                }
                const func = this.agent.executionContextStack[0].Function;

                const breakpoint = this._breakpoints.find((b) => {
                    if (SameValue(b.func.func, func) !== Value.true) {
                        return false;
                    }

                    const startLine = step.node.location.start.line - 1;
                    const startColumn = step.node.location.start.column;

                    return (
                        b.lineNumber === startLine &&
                        b.columnNumber === startColumn
                    );
                });

                if (
                    breakpoint &&
                    breakpoint.states.includes(step.evaluationState)
                ) {
                    if (step.evaluationState === 'before') {
                        yield {
                            state: step.evaluationState,
                            breakpoint,
                            node: step.node,
                            stack: [...this.agent.executionContextStack],
                        };
                    } else {
                        yield {
                            state: step.evaluationState,
                            result: EnsureCompletion(step.result),
                            breakpoint,
                            node: step.node,
                            stack: [...this.agent.executionContextStack],
                        };
                    }
                }
            }
        }

        const copied = this.copyFromValue(result.Value, (obj) => {
            if (obj instanceof Error) {
                let newStack = mapErrorLineNumbers(
                    obj,
                    (lineNumber, fileName, funcName) =>
                        fileName === func.name || funcName === func.name
                            ? lineNumber - 1
                            : lineNumber
                );
                (obj as any).oldStack = obj.stack;
                obj.stack = newStack;
            }
        });

        if (result.Type !== 'normal') {
            throw copied;
        }
        return copied;
    }

    /**
     * Constructs a new interpreted object that proxies all of it's properties back to the given object.
     * @param obj The object that should be proxied.
     */
    proxyObject(obj: Object): Completion<Value> {
        const target = OrdinaryObjectCreate(
            this.realm.Intrinsics['%Object.prototype%'],
            []
        );
        const handler = OrdinaryObjectCreate(
            this.realm.Intrinsics['%Object.prototype%'],
            []
        );

        const _this = this;
        function copyToValue(value: any): Value {
            if (typeof value === 'function') {
                return wrapFunc(value);
            } else if (value !== null && typeof value === 'object') {
                return _this.proxyObject(value);
            } else {
                return _this.copyToValue(value);
            }
        }

        function wrapFunc(func: Function) {
            return CreateBuiltinFunction(
                (args: any[], opts: { thisValue: Value; NewTarget: Value }) => {
                    const thisValue =
                        opts.thisValue === target ? target : undefined;
                    const a = args.map((a) => _this.copyFromValue(a));
                    const result = func.apply(thisValue, a);
                    return copyToValue(result);
                },
                func.length,
                new Value(func.name),
                [],
                _this.realm
            );
        }

        const getHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, prop, reciever] = args;

                if (t === target) {
                    const p = this.copyFromValue(prop);

                    const result = Reflect.get(obj, p);
                    return copyToValue(result);
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            3,
            new Value('getHandler'),
            [],
            this.realm
        );

        const setHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, prop, value] = args;

                if (t === target) {
                    const p = this.copyFromValue(prop);
                    const val = this.copyFromValue(value);

                    return EnsureCompletion(
                        Reflect.set(obj, p, val) ? Value.true : Value.false
                    );
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            3,
            new Value('setHandler'),
            [],
            this.realm
        );

        const deleteHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, prop] = args;

                if (t === target) {
                    const p = this.copyFromValue(prop);
                    return EnsureCompletion(
                        Reflect.deleteProperty(obj, p)
                            ? Value.true
                            : Value.false
                    );
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            2,
            new Value('deleteHandler'),
            [],
            this.realm
        );

        const hasHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, key] = args;

                if (t === target) {
                    const p = this.copyFromValue(key);
                    return EnsureCompletion(
                        Reflect.has(obj, p) ? Value.true : Value.false
                    );
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            2,
            new Value('hasHandler'),
            [],
            this.realm
        );

        const definePropertyHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, prop, descriptor] = args;

                if (t === target) {
                    const p = this.copyFromValue(prop);
                    const desc = this.copyFromValue(descriptor);
                    return EnsureCompletion(
                        Reflect.defineProperty(obj, p, desc)
                            ? Value.true
                            : Value.false
                    );
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            3,
            new Value('definePropertyHandler'),
            [],
            this.realm
        );

        unwind(Set(handler, new Value('get'), getHandler, Value.true));
        unwind(Set(handler, new Value('set'), setHandler, Value.true));
        unwind(
            Set(handler, new Value('deleteProperty'), deleteHandler, Value.true)
        );
        unwind(Set(handler, new Value('has'), hasHandler, Value.true));
        unwind(
            Set(
                handler,
                new Value('defineProperty'),
                definePropertyHandler,
                Value.true
            )
        );

        return EnsureCompletion(
            unwind(
                Construct(this.realm.Intrinsics['%Proxy%'] as ObjectValue, [
                    target,
                    handler,
                ])
            )
        );
    }

    /**
     * Sets the given breakpoint for execution.
     * @param breakpoint The breakpoint that should be set.
     */
    setBreakpoint(breakpoint: Breakpoint) {
        let exists = this._breakpoints.some((b) => b.id === breakpoint.id);
        if (!exists) {
            this._breakpoints.push(breakpoint);
        }
    }

    /**
     * Lists the possible breakpoint locations for the given function.
     * @param func The function.
     */
    listPossibleBreakpoints(
        func: ConstructedFunction
    ): PossibleBreakpointLocation[] {
        if (!isECMAScriptFunctionObject(func.func)) {
            throw new Error(
                'Cannot list possible breakpoints for an object that does not have code.'
            );
        }

        let code = (func.func as any).ECMAScriptCode as ECMAScriptNode;

        let locations = [] as PossibleBreakpointLocation[];

        for (let visisted of traverse(code)) {
            const node = visisted.node;
            let possibleStates = POSSIBLE_BREAKPOINT_LOCATIONS[node.type];
            if (possibleStates) {
                locations.push({
                    lineNumber: node.location.start.line - 1,
                    columnNumber: node.location.start.column,
                    possibleStates,
                });
            }

            let nestedStates = NESTED_BREAKPOINTS[node.type];
            if (nestedStates) {
                for (let [prop, type] of nestedStates) {
                    if (prop in node) {
                        const child = (node as any)[prop] as ECMAScriptNode;

                        if (child && child.type === type) {
                            locations.push({
                                lineNumber: child.location.start.line - 1,
                                columnNumber: child.location.start.column,
                                possibleStates,
                            });
                        }
                    }
                }
            }
        }

        return locations;
    }

    /**
     * Copies the given value as a new interpreted object.
     * @param value The value that should be copied.
     */
    copyToValue(value: any): Completion<Value> {
        switch (typeof value) {
            case 'bigint':
                return NormalCompletion(new BigIntValue(value));
            case 'boolean':
                return NormalCompletion(value ? Value.true : Value.false);
            case 'number':
                return NormalCompletion(new NumberValue(value));
            case 'string':
                return NormalCompletion(new JSStringValue(value));
            case 'symbol':
                return NormalCompletion(this._getOrCreateSymbolFromReal(value));
            case 'undefined':
                return NormalCompletion(Value.undefined);
            case 'object':
                return this._copyToObject(value as Object);
        }
    }

    /**
     * Copies the given value as a new regular JS object.
     * @param value The value that should be copied.
     * @param transformObject An optional function that can be used to transform objects.
     */
    copyFromValue(value: Value, transformObject?: (obj: Object) => void): any {
        if (!(value instanceof Value)) {
            return value;
        }
        switch (Type(value)) {
            case 'BigInt':
                return (value as BigIntValue).bigintValue();
            case 'Boolean':
                return (value as BooleanValue).booleanValue();
            case 'String':
                return (value as JSStringValue).stringValue();
            case 'Null':
                return null;
            case 'Undefined':
                return undefined;
            case 'Number':
                return (value as NumberValue).numberValue();
            case 'Symbol':
                return this._getOrCreateSymbolFromValue(value as SymbolValue);
            case 'Object':
                return this._copyFromObject(
                    value as ObjectValue,
                    transformObject
                );
            // case ''
        }
    }

    private _copyToObject(value: Object): Completion<Value> {
        if (value === null) {
            return NormalCompletion(Value.null);
        }
        try {
            const proto = this._getObjectInterpretedProto(value);
            const constructor = this._getInterpretedObjectConstructor(proto);

            if (constructor) {
                return constructor(value as any, this);
            }

            const obj = OrdinaryObjectCreate(proto, []);

            for (let prop of Object.getOwnPropertyNames(value)) {
                let propNameResult = this.copyToValue(prop);
                if (propNameResult.Type !== 'normal') {
                    return propNameResult;
                }
                let propName = propNameResult.Value;
                if (
                    Type(propName) !== 'String' &&
                    Type(propName) !== 'Symbol'
                ) {
                    throw new Error(
                        'Unable to copy properties with non string or symbol names!'
                    );
                }

                const propValue = (value as any)[prop];

                const newValueResult = this.copyToValue(propValue);

                if (newValueResult.Type !== 'normal') {
                    return newValueResult;
                }

                unwind(
                    Set(obj, propName, newValueResult.Value, BooleanValue.true)
                );
            }

            return NormalCompletion(obj);
        } catch (err) {
            const result = unwind(
                Construct(this.realm.Intrinsics['%Error%'] as ObjectValue, [
                    new Value('Unable to copy value'),
                ])
            );

            if ('Type' in result && result.Type === 'normal') {
                (result.Value as any).__original_error = err;
                return ThrowCompletion(result.Value);
            } else {
                (result as any).__original_error = err;
            }

            return EnsureCompletion(result);
        }
    }

    private _copyFromObject(
        value: ObjectValue,
        transformObject?: (obj: object) => void
    ): object {
        const proto = this._getObjectRealProto(value);
        const constructor = this._getRealObjectConstructor(proto);

        if (constructor) {
            return constructor(value, this);
        }

        const obj = Object.create(proto);

        for (let [prop, val] of value.properties.entries()) {
            let propName = this.copyFromValue(prop);
            if (typeof propName !== 'string' && typeof propName !== 'symbol') {
                throw new Error(
                    'Unable to copy properties with non string or symbol names!'
                );
            }

            const propValue = unwind(Get(value, prop));

            if (propValue.Type !== 'normal') {
                throw new Error('An error occurred while getting a property.');
            }

            obj[propName] = this.copyFromValue(
                propValue.Value,
                transformObject
            );
        }

        if (transformObject) {
            transformObject(obj);
        }

        return obj;
    }

    private _getObjectInterpretedProto(value: Object) {
        let proto = Object.getPrototypeOf(value);
        while (typeof proto === 'object' && proto !== null) {
            for (let [key, prototype] of builtinPrototypes) {
                if (proto === prototype) {
                    return this.realm.Intrinsics[key] as ObjectValue;
                }
            }

            proto = Object.getPrototypeOf(proto);
        }

        return null;
    }

    private _getObjectRealProto(value: ObjectValue) {
        let proto = value.GetPrototypeOf();
        while (Type(proto) === 'Object') {
            for (let [key, prototype] of builtinPrototypes) {
                if (
                    SameValue(proto, this.realm.Intrinsics[key]) === Value.true
                ) {
                    return prototype;
                }
            }

            proto = (proto as ObjectValue).GetPrototypeOf();
        }

        return null;
    }

    private _getInterpretedObjectConstructor(prototype: ObjectValue) {
        for (let [intrinsic, proto, _, construct] of builtinConstructors) {
            if (
                SameValue(this.realm.Intrinsics[intrinsic], prototype) ===
                Value.true
            ) {
                return construct;
            }
        }

        return null;
    }

    private _getRealObjectConstructor(prototype: Object) {
        for (let [intrinsic, proto, construct] of builtinConstructors) {
            if (proto === prototype) {
                return construct;
            }
        }

        return null;
    }

    private _getOrCreateSymbolFromReal(value: symbol): SymbolValue {
        if (this._realSymbolMap.has(value)) {
            return this._realSymbolMap.get(value);
        } else {
            const s = new SymbolValue(value.description);
            this._realSymbolMap.set(value, s);
            return s;
        }
    }

    private _getOrCreateSymbolFromValue(value: SymbolValue): symbol {
        if (this._valueSymbolMap.has(value)) {
            return this._valueSymbolMap.get(value);
        } else {
            const s = Symbol((value as any).Description);
            this._valueSymbolMap.set(value, s);
            return s;
        }
    }

    private _setupGlobals() {
        this.realm.scope(() => {
            const con = OrdinaryObjectCreate(
                this.realm.Intrinsics['%Object.prototype%'],
                []
            );

            CreateDataProperty(
                this.realm.GlobalObject,
                new Value('console'),
                con
            );

            const mapArgs = (args: Value[]) =>
                args.map((arg, index) => {
                    if (index === 0 && Type(arg) === 'String') {
                        return (arg as JSStringValue).stringValue();
                    } else {
                        return inspect(arg);
                    }
                });

            const log = CreateBuiltinFunction(
                (args: Value[]) => {
                    console.log(...mapArgs(args));
                },
                1,
                new Value('log'),
                [],
                this.realm
            );

            const error = CreateBuiltinFunction(
                (args: Value[]) => {
                    console.error(...mapArgs(args));
                },
                1,
                new Value('error'),
                [],
                this.realm
            );

            const warn = CreateBuiltinFunction(
                (args: Value[]) => {
                    console.warn(...mapArgs(args));
                },
                1,
                new Value('warn'),
                [],
                this.realm
            );

            CreateDataProperty(con, new Value('log'), log);
            CreateDataProperty(con, new Value('error'), error);
            CreateDataProperty(con, new Value('warn'), warn);
        });
    }

    // getBreakpointRanges(node: ECMAScriptNode) {
    //     // const stack = this.agent.executionContextStack;

    //     // if (stack.length <= 0) {
    //     //     throw new Error('Cannot check for breakpoints if the stack is empty!');
    //     // }

    //     const startLine = node.location.start.line;
    //     const startColumn = node.location.start.column;
    //     const startIndex = node.location.startIndex;

    //     const children = getChildNodes(node);

    //     let endLine = node.location.end.line;
    //     let endColumn = node.location.end.column;
    //     let endIndex = node.location.endIndex;

    //     if (endLine === startLine && endColumn === startColumn && endIndex !== startIndex) {
    //         endColumn = startColumn + (endIndex - startIndex);
    //     }

    //     for(let child of children) {
    //         if (child === node) {
    //             continue;
    //         }

    //         let loc = child.location;

    //         // if (loc.startIndex === startIndex) {
    //         //     break;
    //         // }

    //         if (loc.startIndex > (startIndex + 1) && loc.startIndex < endIndex) {
    //             endLine = child.location.end.line;
    //             endColumn = child.location.end.column - 1;
    //             break;
    //         }
    //     }

    //     return [
    //         {
    //             startLine: startLine - 1,
    //             startColumn,
    //             endLine: endLine - 1,
    //             endColumn
    //             // func: stack[0].Function
    //         }
    //     ];
    // }
}

function mapErrorLineNumbers(
    error: Error,
    mapper: (
        lineNumber: number,
        fileName: string,
        functionName: string
    ) => number
) {
    let stackFrames = ErrorStackParser.parse(error);

    let newFrames = stackFrames.map((frame) => {
        if (!('lineNumber' in frame) || typeof frame.lineNumber !== 'number') {
            let keys = Object.keys(frame);

            if (keys.length === 1 && keys[0] === 'functionName') {
                return null;
            } else if (
                keys.length === 2 &&
                keys.includes('fileName') &&
                keys.includes('source')
            ) {
                return null;
            }

            return frame;
        }
        let newLineNumber = mapper(
            frame.lineNumber,
            frame.fileName,
            frame.functionName
        );
        if (newLineNumber === frame.lineNumber) {
            return frame;
        }

        return new StackFrame({
            fileName: frame.fileName,
            functionName: frame.functionName,
            lineNumber: newLineNumber,
            columnNumber: frame.columnNumber,
        });
    });

    const stack = newFrames
        .filter((frame) => !!frame)
        .map((frame) => '  at ' + frame.toString())
        .join('\n');

    return error.toString() + '\n' + stack;
}

export interface ConstructedFunction {
    module: SourceTextModuleRecord;
    func: ObjectValue;
    name: string;
}

export type InterpreterContinuation = null | 'step-in' | 'step-out';

export type InterpreterStop = InterpreterBeforeStop | InterpreterAfterStop;

export interface InterpreterStopBase {
    /**
     * The node that the interpreter has stopped at.
     */
    node: any;

    /**
     * The breakpoint that triggered this stop.
     */
    breakpoint: Breakpoint;

    /**
     * The stack of execution contexts.
     */
    stack: ExecutionContextStack;
}

/**
 * Defines an interface that contains information about the current stop state of the interpreter.
 */
export interface InterpreterBeforeStop extends InterpreterStopBase {
    /**
     * Whether this stop occurred before or after the node.
     */
    state: 'before';
}

/**
 * Defines an interface that contains information about the current stop state of the interpreter.
 */
export interface InterpreterAfterStop extends InterpreterStopBase {
    /**
     * Whether this stop occurred before or after the node.
     */
    state: 'after';

    /**
     * The result of the expression/statement.
     */
    result: Completion<Value>;
}

/**
 * Defines an interface for a possible breakpoint location.
 */
export interface PossibleBreakpointLocation {
    /**
     * The line number that the breakpoint stops at.
     */
    lineNumber: number;

    /**
     * The column number that the breakpoint stops at.
     */
    columnNumber: number;

    /**
     * The states that are reasonable for this breakpoint to stop at.
     */
    possibleStates: PossibleBreakpointStates;
}

/**
 * Defines an interface for a breakpoint.
 * That is, a spot where code execution should be paused.
 */
export interface Breakpoint {
    /**
     * The ID of the breakpoint.
     */
    id: string;

    /**
     * The function that the breakpoint applies to.
     */
    func: ConstructedFunction;

    /**
     * The line number that the breakpoint stops at.
     */
    lineNumber: number;

    /**
     * The column number that the breakpoint stops at.
     */
    columnNumber: number;

    /**
     * The list of states that the breakpoint applies for.
     * - "before" indicates that the breakpoint stops before the node executes.
     * - "after" indicates that the breakpoint stops after the node executes.
     */
    states: ('before' | 'after')[];
}

export interface BreakpointEntry {
    breakpoint: Breakpoint;
    location: ECMAScriptNode['location'];
}

const VISITOR_KEYS: {
    [key: string]: string[];
} = {
    Script: ['ScriptBody'],
    ScriptBody: ['StatementList'],
    FunctionBody: ['FunctionStatementList'],
    ReturnStatement: ['Expression'],
    IfStatement: ['Expression', 'Statement_a', 'Statement_b'],
    Block: ['StatementList'],
    ExpressionStatement: ['Expression'],
    AdditiveExpression: ['AdditiveExpression', 'MultiplicativeExpression'],
    MultiplicativeExpression: [
        'ExponentiationExpression',
        'MultiplicativeExpression',
    ],
    MemberExpression: ['MemberExpression', 'Expression', 'IdentifierName'],
    ObjectLiteral: ['PropertyDefinitionList'],
    PropertyDefinition: ['AssignmentExpression', 'PropertyName'],
    BooleanLiteral: [],
    NumericLiteral: [],
    StringLiteral: [],
    EqualityExpression: ['EqualityExpression', 'RelationalExpression'],
    CallExpression: ['CallExpression', 'Arguments'],
    IdentifierName: [],
    IdentifierReference: [],
    LexicalDeclaration: ['BindingList'],
    LexicalBinding: ['BindingIdentifier', 'BindingPattern', 'Initializer'],
    BindingIdentifier: [],
    SwitchStatement: ['Expression', 'CaseBlock'],
    CaseBlock: ['CaseClauses_a', 'DefaultClause'],
    CaseClause: ['Expression', 'StatementList'],
    BreakStatement: [],
    ForStatement: [
        'VariableDeclarationList',
        'Expression_a',
        'Expression_b',
        'Statement',
    ],
    ForOfStatement: ['ForDeclaration', 'AssignmentExpression', 'Statement'],
    ForInStatement: ['ForDeclaration', 'Expression', 'Statement'],
    ForDeclaration: ['ForBinding'],
    ForBinding: ['BindingIdentifier', 'Initializer'],
    WhileStatement: ['Expression', 'Statement'],
    DoWhileStatement: ['Expression', 'Statement'],
    TryStatement: ['Block', 'Catch', 'Finally'],
    Catch: ['CatchParameter', 'Block'],
    FunctionDeclaration: [
        'BindingIdentifier',
        'FormalParameters',
        'FunctionBody',
    ],
    SingleNameBinding: ['BindingIdentifier', 'Initializer'],
    ArrowFunction: ['ArrowParameters', 'ConciseBody'],
    ConciseBody: ['ExpressionBody'],
    ObjectBindingPattern: ['BindingPropertyList'],
    ArrayBindingPattern: ['BindingElementList'],
    BindingProperty: ['BindingElement', 'PropertyName'],
    BindingElement: ['BindingPattern', 'Initializer'],
    TemplateLiteral: ['ExpressionList'],
    ConditionalExpression: [
        'ShortCircuitExpression',
        'AssignmentExpression_a',
        'AssignmentExpression_b',
    ],
    CoalesceExpression: ['CoalesceExpressionHead', 'BitwiseORExpression'],
    NullLiteral: [],
    ParenthesizedExpression: ['Expression'],
    AsyncArrowFunction: ['ArrowParameters', 'AsyncConciseBody'],
    AsyncFunctionDeclaration: [
        'BindingIdentifier',
        'FormalParameters',
        'AsyncFunctionBody',
    ],
    AsyncFunctionBody: ['FunctionStatementList'],
    GeneratorDeclaration: [
        'BindingIdentifier',
        'FormalParameters',
        'GeneratorBody',
    ],
    GeneratorBody: ['FunctionStatementList'],
    AsyncGeneratorDeclaration: [
        'BindingIdentifier',
        'FormalParameters',
        'AsyncGeneratorBody',
    ],
    AsyncGeneratorBody: ['FunctionStatementList'],
    ClassDeclaration: ['BindingIdentifier', 'ClassTail'],
    ClassTail: ['ClassHeritage', 'ClassBody'],
    FieldDefinition: ['ClassElementName', 'Initializer'],
    MethodDefinition: [
        'ClassElementName',
        'UniqueFormalParameters',
        'FunctionBody',
    ],
    AsyncMethod: [
        'ClassElementName',
        'UniqueFormalParameters',
        'AsyncFunctionBody',
    ],
    GeneratorMethod: [
        'ClassElementName',
        'UniqueFormalParameters',
        'GeneratorBody',
    ],
    AsyncGeneratorMethod: [
        'ClassElementName',
        'UniqueFormalParameters',
        'AsyncGeneratorBody',
    ],
    AssignmentExpression: ['LeftHandSideExpression', 'AssignmentExpression'],
    ThisExpression: [],
    SuperCall: ['Arguments'],
    SuperProperty: ['IdentifierName', 'Expression'],
    VariableStatement: ['VariableDeclarationList'],
    VariableDeclaration: ['BindingIdentifier', 'Initializer'],
    BitwiseANDExpression: ['A', 'B'],
    BitwiseORExpression: ['A', 'B'],
    BitwiseXORExpression: ['A', 'B'],
    RelationalExpression: ['RelationalExpression', 'ShiftExpression'],
};

/**
 * Traverses over the given node.
 * @param node The node.
 */
export function traverse(
    node: ECMAScriptNode
): Generator<VisitedNode, void, VisitorOption> {
    return traverseCore(node, 0, null, null);
}

/**
 * Traverses over the given node.
 * @param node The node.
 */
function* traverseCore(
    node: ECMAScriptNode,
    depth: number,
    parent: VisitedNode,
    key: string
): Generator<VisitedNode, void, VisitorOption> {
    let visisted: VisitedNode = {
        node,
        parent,
        key,
        depth,
    };
    let option = yield visisted;

    if (option === 'skip') {
        return;
    }

    let keys = VISITOR_KEYS[node.type];

    if (!keys || keys.length <= 0) {
        return;
    }

    for (let key of keys) {
        let child = (node as any)[key];
        if (!child) {
            continue;
        }

        if (Array.isArray(child)) {
            for (let c of child) {
                yield* traverseCore(c, depth + 1, visisted, key);
            }
        } else {
            yield* traverseCore(child, depth + 1, visisted, key);
        }
    }
}

function* getChildNodes(
    node: ECMAScriptNode
): Generator<ECMAScriptNode, void, void> {
    yield node;

    let keys = VISITOR_KEYS[node.type];
    for (let key of keys) {
        let child = (node as any)[key] as ECMAScriptNode | ECMAScriptNode[];
        if (!child) {
            continue;
        }

        if (Array.isArray(child)) {
            for (let c of child) {
                yield* getChildNodes(c);
            }
        } else {
            yield* getChildNodes(child);
        }
    }
}

export type VisitorOption = null | void | 'skip';

export interface VisitedNode {
    node: ECMAScriptNode;
    parent: VisitedNode;
    key: string;
    depth: number;
}

// export class LocationlessStackFrame extends StackFrame {

//     toString() {

//     }

// }

// export interface PartialStackFrame {
//     lineNumber: number;
// }
