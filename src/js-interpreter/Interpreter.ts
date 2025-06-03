/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* eslint-disable @typescript-eslint/no-wrapper-object-types */
import type {
    BooleanValue,
    SourceTextModuleRecord,
    ExecutionContextStack,
    ECMAScriptNode,
    Descriptor,
} from '@casual-simulation/engine262';
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
    NumberValue,
    SymbolValue,
    ObjectValue,
    SameValue,
    Get,
    Completion,
    ThrowCompletion,
    Construct,
    NormalCompletion,
    Set,
    EnsureCompletion,
    Call,
    CreateArrayFromList,
    DefinePropertyOrThrow,
    ToPropertyDescriptor,
    IsCallable,
    DeletePropertyOrThrow,
    HasProperty,
    runJobQueue,
    IsArray,
    wellKnownSymbols,
    EVAL_YIELD,
} from '@casual-simulation/engine262';
import type { EvaluationYield } from '@casual-simulation/engine262/types/evaluator';
import { copyPrototypes, proxyPrototypes } from './Marshalling';
import {
    getInterpreterObject,
    getRegularObject,
    INTERPRETER_OBJECT,
    isConstructor,
    isGenerator,
    IS_PROXY_OBJECT,
    markAsProxyObject,
    markWithInterpretedObject,
    markWithRegularObject,
    REGULAR_OBJECT,
    UNCOPIABLE,
    unwind,
} from './InterpreterUtils';

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
    private _valueSymbolMap = new Map<Value, symbol>([
        [wellKnownSymbols.asyncIterator, Symbol.asyncIterator] as const,
        [wellKnownSymbols.hasInstance, Symbol.hasInstance] as const,
        [
            wellKnownSymbols.isConcatSpreadable,
            Symbol.isConcatSpreadable,
        ] as const,
        [wellKnownSymbols.iterator, Symbol.iterator] as const,
        [wellKnownSymbols.match, Symbol.match] as const,
        [wellKnownSymbols.matchAll, Symbol.matchAll] as const,
        [wellKnownSymbols.replace, Symbol.replace] as const,
        [wellKnownSymbols.search, Symbol.search] as const,
        [wellKnownSymbols.split, Symbol.split] as const,
        [wellKnownSymbols.toPrimitive, Symbol.toPrimitive] as const,
        [wellKnownSymbols.toStringTag, Symbol.toStringTag] as const,
        [wellKnownSymbols.unscopables, Symbol.unscopables] as const,
    ]);
    private _realSymbolMap = new Map<symbol, SymbolValue>([
        [Symbol.asyncIterator, wellKnownSymbols.asyncIterator] as const,
        [Symbol.hasInstance, wellKnownSymbols.hasInstance] as const,
        [
            Symbol.isConcatSpreadable,
            wellKnownSymbols.isConcatSpreadable,
        ] as const,
        [Symbol.iterator, wellKnownSymbols.iterator] as const,
        [Symbol.match, wellKnownSymbols.match] as const,
        [Symbol.matchAll, wellKnownSymbols.matchAll] as const,
        [Symbol.replace, wellKnownSymbols.replace] as const,
        [Symbol.search, wellKnownSymbols.search] as const,
        [Symbol.split, wellKnownSymbols.split] as const,
        [Symbol.toPrimitive, wellKnownSymbols.toPrimitive] as const,
        [Symbol.toStringTag, wellKnownSymbols.toStringTag] as const,
        [Symbol.unscopables, wellKnownSymbols.unscopables] as const,
    ]);
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

    /**
     * Gets the list of breakpoints that have been set on this interpreter.
     */
    get breakpoints() {
        return this._breakpoints;
    }

    constructor() {
        this.agent = new Agent({});
        setSurroundingAgent(this.agent);
        this.realm = new ManagedRealm({});
        this.agent.executionContextStack.push((this.realm as any).topContext);

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
            record.Link();
            record.EvaluateAndUnwind();
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

        const module = this.createAndLinkModule(code, functionName);
        const func = module.Environment.GetBindingValue(
            new Value(functionName),
            Value.true
        );

        let constructedFunction: ConstructedFunction = {
            module,
            func: func as ObjectValue,
            name: functionName,
        };
        (module as any)[CONSTRUCTED_FUNCTION] = constructedFunction;

        return constructedFunction;
    }

    /**
     * Calls the given function
     * @param func The function that should be called.
     * @param args The arguments that should be provided to the function.
     */
    callFunction(
        func: ConstructedFunction,
        ...args: any[]
    ): Generator<InterpreterStop, any, InterpreterContinuation> {
        setSurroundingAgent(this.agent);
        const _this = this;
        function* gen() {
            let a = args.map((a) => {
                const result = _this.copyToValue(a);
                if (result.Type !== 'normal') {
                    throw _this.copyFromValue(result.Value);
                }
                return result.Value;
            });

            const generator = Call(func.func, Value.null, a);
            const result = yield* _this._handleBreakpoints(generator);
            const copied = _this.copyFromValue(result.Value);

            if (result.Type !== 'normal') {
                throw copied;
            }
            return copied;
        }

        return gen();
    }

    /**
     * Runs the job queue and yields with any interpreter breaks that are encountered along the way.
     */
    runJobQueue(): Generator<InterpreterStop, void, InterpreterContinuation> {
        setSurroundingAgent(this.agent);

        const _this = this;
        function* gen() {
            return yield* _this._handleBreakpoints(runJobQueue());
        }

        return gen();
    }

    private *_handleBreakpoints<T>(
        generator: Generator<EvaluationYield, T, unknown>
    ): Generator<InterpreterStop, T, InterpreterContinuation> {
        while (true) {
            setSurroundingAgent(this.agent);
            let { done, value } = generator.next();

            if (done) {
                return value as T;
            } else if (this.debugging) {
                if (!(EVAL_YIELD in (value as any))) {
                    yield value as unknown as InterpreterStop;
                    continue;
                }
                const step = value as EvaluationYield;

                const possibleLocations =
                    POSSIBLE_BREAKPOINT_LOCATIONS[step.node.type];
                if (
                    !possibleLocations ||
                    !possibleLocations.includes(step.evaluationState)
                ) {
                    continue;
                }
                const module =
                    this.agent.runningExecutionContext.ScriptOrModule;

                const breakpoint = this._breakpoints.find((b) => {
                    if (b.disabled || b.func.module !== module) {
                        return false;
                    }

                    const startLine = step.node.location.start.line;
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
    }

    // private _createTransformObjectFunction(func: ConstructedFunction) {
    //     return (obj: any) => {
    //         if (obj instanceof Error) {
    //             transformErrorLineNumbers(obj, func.name);
    //         }
    //     };
    // }

    /**
     * Constructs a new interpreted object that proxies all of it's properties back to the given object.
     * @param obj The object that should be proxied.
     */
    proxyObject(obj: Object): Completion<Value> {
        if (typeof obj !== 'function') {
            if (typeof obj !== 'object' || obj === null) {
                return this.copyToValue(obj);
            }
        }

        if (INTERPRETER_OBJECT in obj) {
            return NormalCompletion(getInterpreterObject(obj));
        }

        const [proto] = this._getObjectInterpretedProto(obj);
        const constructor = this._getInterpretedProxyConstructor(proto);

        if (constructor) {
            return constructor(obj, proto, this);
        }

        let target: ObjectValue;

        const _this = this;
        function copyToValue(value: any): Completion<Value> {
            if (
                typeof value === 'function' ||
                (value !== null &&
                    typeof value === 'object' &&
                    (!(value instanceof Error) || INTERPRETER_OBJECT in value))
            ) {
                return _this.proxyObject(value);
            } else {
                return _this.copyToValue(value);
            }
        }

        function copyFromValue(value: Value): any {
            if (IsCallable(value) === Value.true || Type(value) === 'Object') {
                return _this.reverseProxyObject(value);
            } else {
                return _this.copyFromValue(value);
            }
        }

        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                target = CreateArrayFromList([]);
            } else {
                target = OrdinaryObjectCreate(
                    this.realm.Intrinsics['%Object.prototype%'],
                    []
                );
            }
        } else if (typeof obj === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
            let func = obj as Function;
            target = CreateBuiltinFunction(
                function* (
                    args: any[],
                    opts: { thisValue: Value; NewTarget: Value }
                ) {
                    const thisValue = copyFromValue(opts.thisValue);
                    const newTarget = copyFromValue(opts.NewTarget);
                    const a = args.map((a) => _this.copyFromValue(a));
                    try {
                        if (newTarget !== undefined) {
                            const result = Reflect.construct(
                                func,
                                a,
                                newTarget
                            );
                            return copyToValue(result);
                        }

                        const result = func.apply(thisValue, a);

                        if (isGenerator(result)) {
                            return copyToValue(yield* result);
                        }

                        return copyToValue(result);
                    } catch (err) {
                        const copied = copyToValue(err);
                        if (copied.Type !== 'normal') {
                            return copied;
                        }
                        return ThrowCompletion(copied.Value);
                    }
                },
                func.length,
                new Value(func.name),
                [],
                this.realm,
                undefined,
                undefined,
                isConstructor(func) ? Value.true : Value.false
            );
        } else {
            throw new Error('Cannot proxy primitive values.');
        }

        // const target = ;
        const handler = OrdinaryObjectCreate(
            this.realm.Intrinsics['%Object.prototype%'],
            []
        );

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

                    const success = Reflect.defineProperty(obj, p, desc);

                    if (!success) {
                        return NormalCompletion(Value.false);
                    }

                    return EnsureCompletion(
                        target.DefineOwnProperty(
                            prop,
                            ToPropertyDescriptor(descriptor)
                        )
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

        const getOwnPropertyDescriptor = CreateBuiltinFunction(
            (args: any[]) => {
                const [t, prop] = args;

                if (t === target) {
                    const p = this.copyFromValue(prop);
                    const desc = Reflect.getOwnPropertyDescriptor(obj, p);

                    if (!desc) {
                        return NormalCompletion(Value.undefined);
                    }

                    const d = OrdinaryObjectCreate(
                        this.realm.Intrinsics['%Object.prototype%'],
                        []
                    );

                    unwind(
                        Set(
                            d,
                            new Value('configurable'),
                            desc.configurable ? Value.true : Value.false,
                            Value.true
                        )
                    );
                    unwind(
                        Set(
                            d,
                            new Value('enumerable'),
                            desc.enumerable ? Value.true : Value.false,
                            Value.true
                        )
                    );

                    if ('value' in desc) {
                        const copiedValueResult = copyToValue(desc.value);
                        if (copiedValueResult.Type !== 'normal') {
                            return copiedValueResult;
                        }
                        unwind(
                            Set(
                                d,
                                new Value('value'),
                                copiedValueResult.Value,
                                Value.true
                            )
                        );
                        unwind(
                            Set(
                                d,
                                new Value('writable'),
                                desc.writable ? Value.true : Value.false,
                                Value.true
                            )
                        );
                    } else {
                        const copiedGetterResult = copyToValue(desc.get);
                        if (copiedGetterResult.Type !== 'normal') {
                            return copiedGetterResult;
                        }
                        const copiedSetterResult = copyToValue(desc.set);
                        if (copiedSetterResult.Type !== 'normal') {
                            return copiedSetterResult;
                        }
                        unwind(
                            Set(
                                d,
                                new Value('get'),
                                copiedGetterResult.Value,
                                Value.true
                            )
                        );
                        unwind(
                            Set(
                                d,
                                new Value('set'),
                                copiedSetterResult.Value,
                                Value.true
                            )
                        );
                    }

                    return NormalCompletion(d);
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            2,
            new Value('getOwnPropertyDescriptor'),
            [],
            this.realm
        );

        const ownKeysHandler = CreateBuiltinFunction(
            (args: any[]) => {
                const [t] = args;

                if (t === target) {
                    const keys = Reflect.ownKeys(obj);
                    let results = [];
                    for (let key of keys) {
                        let result = this.copyToValue(key);
                        if (result.Type !== 'normal') {
                            return result;
                        }
                        results.push(result.Value);
                    }

                    return EnsureCompletion(CreateArrayFromList(results));
                } else {
                    return EnsureCompletion(Value.undefined);
                }
            },
            1,
            new Value('ownKeysHandler'),
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
        unwind(
            Set(
                handler,
                new Value('getOwnPropertyDescriptor'),
                getOwnPropertyDescriptor,
                Value.true
            )
        );
        unwind(Set(handler, new Value('ownKeys'), ownKeysHandler, Value.true));

        const result = markAsProxyObject(
            markWithRegularObject(
                unwind(
                    Construct(this.realm.Intrinsics['%Proxy%'] as ObjectValue, [
                        target,
                        handler,
                    ])
                ),
                obj
            )
        );

        markWithInterpretedObject(obj, result);

        return EnsureCompletion(result);
    }

    /**
     * Proxies the given interpreted value as a native JavaScript object.
     * @param obj The interpreted object that should be proxied.
     * @param allowBreakpointsInFunction Whether the object should yield breakpoints when it is called as a function or if it should execute normally. (Default true)
     */
    reverseProxyObject(
        obj: Value,
        allowBreakpointsInFunction: boolean = true
    ): any {
        if (!(obj instanceof ObjectValue)) {
            return this.copyFromValue(obj);
        }

        if (REGULAR_OBJECT in obj) {
            return getRegularObject(obj);
        }

        const [proto] = this._getObjectRealProto(obj);
        const constructor = this._getRealProxyConstructor(proto);

        if (constructor) {
            return constructor(obj, proto, this);
        }

        let target: any;
        let allowChildFunctionBreakpoints = allowBreakpointsInFunction;

        const _this = this;
        function copyFromValue(value: Value): any {
            if (IsCallable(value) === Value.true || Type(value) === 'Object') {
                return _this.reverseProxyObject(
                    value,
                    allowChildFunctionBreakpoints
                );
            } else {
                return _this.copyFromValue(value);
            }
        }

        function copyToValue(value: any): Value {
            if (
                typeof value === 'function' ||
                (value !== null && typeof value === 'object')
            ) {
                return handleCompletion(_this.proxyObject(value));
            } else {
                return handleCompletion(_this.copyToValue(value));
            }
        }

        function handleCompletion<T>(
            completion: T | Completion<T>,
            func?: ObjectValue
        ): T {
            const c = EnsureCompletion(completion);
            if (c.Type === 'normal') {
                return c.Value;
            } else {
                throw _this.copyFromValue(c.Value);
            }
        }

        if (IsCallable(obj) === Value.true) {
            if (allowBreakpointsInFunction) {
                target = function* (...args: any[]) {
                    // const thisValue = this === target ? target : Value.undefined;
                    const a = args.map((a) =>
                        handleCompletion(_this.copyToValue(a))
                    );
                    const thisProxy = copyToValue(this);
                    const result = handleCompletion(
                        yield* _this._handleBreakpoints(
                            Call(obj, thisProxy, a)
                        ),
                        obj
                    );

                    return copyFromValue(result);
                };
            } else {
                target = function (...args: any[]) {
                    // const thisValue = this === target ? target : Value.undefined;
                    const a = args.map((a) =>
                        handleCompletion(_this.copyToValue(a))
                    );
                    const thisProxy = copyToValue(this);
                    const result = handleCompletion(
                        unwind(Call(obj, thisProxy, a)),
                        obj
                    );

                    return copyFromValue(result);
                };
            }
        } else if (obj instanceof ObjectValue) {
            if (IsArray(obj) === Value.true) {
                target = [];
                allowChildFunctionBreakpoints = false;
            } else {
                target = {};
            }
        } else {
            throw new Error('Cannot reverse proxy primitive values.');
        }

        let proxy = new Proxy(target, {
            get: (t, prop, reciever) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT ||
                    (typeof target === 'function' && prop in Function.prototype)
                ) {
                    return Reflect.get(t, prop, reciever);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const result = handleCompletion(unwind(Get(obj, p)));
                    return copyFromValue(result);
                } else {
                    return undefined;
                }
            },

            set: (t, prop, value) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT
                ) {
                    return Reflect.set(t, prop, value);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const val = handleCompletion(this.copyToValue(value));
                    const result = handleCompletion(
                        unwind(Set(obj, p, val, Value.true))
                    );
                    return result === Value.true ? true : false;
                } else {
                    return false;
                }
            },
            deleteProperty: (t, prop) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT
                ) {
                    return Reflect.deleteProperty(t, prop);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const completion = handleCompletion(
                        DeletePropertyOrThrow(obj, p)
                    );
                    return completion === Value.true ? true : false;
                } else {
                    return undefined;
                }
            },
            has: (t, prop) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT
                ) {
                    return Reflect.has(t, prop);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const hasProperty = handleCompletion(HasProperty(obj, p));
                    return hasProperty === Value.true ? true : false;
                } else {
                    return undefined;
                }
            },
            defineProperty: (t, prop, descriptor) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT
                ) {
                    return Reflect.defineProperty(t, prop, descriptor);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const desc = ToPropertyDescriptor(
                        handleCompletion(this.copyToValue(descriptor))
                    );

                    const success = handleCompletion(
                        DefinePropertyOrThrow(obj, p, desc)
                    );

                    if (success === Value.false) {
                        return false;
                    }

                    return Reflect.defineProperty(target, prop, descriptor);
                } else {
                    return undefined;
                }
            },
            getOwnPropertyDescriptor: (t, prop) => {
                if (
                    prop === INTERPRETER_OBJECT ||
                    prop === IS_PROXY_OBJECT ||
                    prop === REGULAR_OBJECT
                ) {
                    return Reflect.getOwnPropertyDescriptor(t, prop);
                }
                if (t === target) {
                    const p = handleCompletion(this.copyToValue(prop));
                    const desc: Descriptor = handleCompletion(
                        obj.GetOwnProperty(p)
                    );

                    if (!desc) {
                        return undefined;
                    }

                    let d = {} as any;

                    d.configurable =
                        desc.Configurable === Value.true ? true : false;
                    d.enumerable =
                        desc.Enumerable === Value.true ? true : false;
                    if (
                        desc.Value !== undefined ||
                        desc.Writable !== undefined
                    ) {
                        d.writable =
                            desc.Writable === Value.true ? true : false;
                        d.value = copyFromValue(desc.Value);
                    } else if (
                        desc.Get !== undefined ||
                        desc.Set !== undefined
                    ) {
                        d.get = copyFromValue(desc.Get);
                        d.set = copyFromValue(desc.Set);
                    }

                    return d;
                } else {
                    return undefined;
                }
            },

            ownKeys: (t) => {
                if (t === target) {
                    let ownKeys: Value[] = handleCompletion(
                        obj.OwnPropertyKeys()
                    );
                    return [
                        ...ownKeys.map((v) => this.copyFromValue(v)),
                        INTERPRETER_OBJECT,
                        IS_PROXY_OBJECT,
                    ];
                } else {
                    return undefined;
                }
            },
        });

        markWithInterpretedObject(proxy, obj);
        markWithRegularObject(obj, proxy);
        markAsProxyObject(proxy);

        return proxy;
    }

    /**
     * Sets the given breakpoint for execution.
     * @param breakpoint The breakpoint that should be set.
     */
    setBreakpoint(breakpoint: Breakpoint) {
        let index = this._breakpoints.findIndex((b) => b.id === breakpoint.id);
        if (index >= 0) {
            this._breakpoints[index] = breakpoint;
        } else {
            this._breakpoints.push(breakpoint);
        }
    }

    /**
     * Removes the breakpoint with the given ID.
     * @param id The ID of the breakpoint that should be removed.
     */
    removeBreakpointById(id: string) {
        let index = this._breakpoints.findIndex((b) => b.id === id);
        if (index >= 0) {
            this._breakpoints.splice(index, 1);
        }
    }

    /**
     * Lists the possible breakpoint locations for the given code.
     * @param code The code.
     */
    listPossibleBreakpoints(
        code: ECMAScriptNode
    ): PossibleBreakpointLocation[] {
        let locations = [] as PossibleBreakpointLocation[];

        for (let visisted of traverse(code)) {
            const node = visisted.node;
            let possibleStates = POSSIBLE_BREAKPOINT_LOCATIONS[node.type];
            if (possibleStates) {
                locations.push({
                    lineNumber: node.location.start.line,
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
                                lineNumber: child.location.start.line,
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
        if (value instanceof Value) {
            return NormalCompletion(value);
        } else if (value instanceof Completion) {
            return value;
        }
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
            case 'function':
                return this._copyToObject(value as object);
            default:
                throw new Error(
                    'Unable to convert value of type: ' + typeof value
                );
        }
    }

    /**
     * Copies the given value as a new regular JS object.
     * @param value The value that should be copied.
     * @param transformObject An optional function that can be used to transform objects.
     */
    copyFromValue(value: Value, transformObject?: (obj: object) => void): any {
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
            default:
                throw new Error(
                    'Unable to convert value of type: ' + Type(value)
                );
            // case ''
        }
    }

    private _copyToObject(value: object): Completion<Value> {
        if (value === null) {
            return NormalCompletion(Value.null);
        }
        if (IS_PROXY_OBJECT in value) {
            return NormalCompletion(getInterpreterObject(value));
        }
        if (UNCOPIABLE in value) {
            return this.proxyObject(value);
        }
        try {
            const [proto, constructor] = this._getObjectInterpretedProto(value);

            if (!constructor) {
                throw new Error(`No constructor found for ${proto}`);
            }

            return constructor(value as any, proto, this);
        } catch (err) {
            const result = EnsureCompletion(
                unwind(
                    Construct(this.realm.Intrinsics['%Error%'] as ObjectValue, [
                        new Value(`Unable to copy value: ${err}`),
                    ])
                )
            );

            if (result.Type === 'normal') {
                (result.Value as any).__original_error = err;
                return ThrowCompletion(result.Value);
            } else {
                throw err;
            }
        }
    }

    private _copyFromObject(
        value: ObjectValue,
        transformObject?: (obj: object) => void
    ): object {
        if (IS_PROXY_OBJECT in value) {
            return getRegularObject(value);
        }

        const [proto, constructor] = this._getObjectRealProto(value);

        if (!constructor) {
            throw new Error(`No constructor found for ${proto}`);
        }

        return constructor(value, proto, this, transformObject);
    }

    private _getObjectInterpretedProto(value: object) {
        let proto = Object.getPrototypeOf(value);
        while (
            (typeof proto === 'object' || typeof proto === 'function') &&
            proto !== null
        ) {
            for (let [key, prototype, constructor] of copyPrototypes) {
                if (
                    proto === prototype ||
                    (prototype === Function.prototype &&
                        typeof value === 'function')
                ) {
                    return [
                        this.realm.Intrinsics[key] as ObjectValue,
                        constructor,
                    ] as const;
                }
            }

            proto = Object.getPrototypeOf(proto);
        }

        return [] as const;
    }

    private _getObjectRealProto(value: ObjectValue) {
        let proto = value.GetPrototypeOf();
        while (Type(proto) === 'Object') {
            for (let [key, prototype, _, constructor] of copyPrototypes) {
                if (
                    SameValue(proto, this.realm.Intrinsics[key]) === Value.true
                ) {
                    return [prototype, constructor] as const;
                }
            }

            proto = (proto as ObjectValue).GetPrototypeOf();
        }

        return [] as const;
    }

    private _getInterpretedProxyConstructor(prototype: ObjectValue) {
        if (!prototype) {
            return null;
        }
        for (let [intrinsic, proto, construct] of proxyPrototypes) {
            if (
                SameValue(this.realm.Intrinsics[intrinsic], prototype) ===
                Value.true
            ) {
                return construct;
            }
        }

        return null;
    }

    private _getRealProxyConstructor(prototype: object) {
        if (!prototype) {
            return null;
        }
        for (let [intrinsic, proto, _, construct] of proxyPrototypes) {
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
            this._valueSymbolMap.set(s, value);
            return s;
        }
    }

    private _getOrCreateSymbolFromValue(value: SymbolValue): symbol {
        if (this._valueSymbolMap.has(value)) {
            return this._valueSymbolMap.get(value);
        } else {
            const s = Symbol((value as any).Description);
            this._valueSymbolMap.set(value, s);
            this._realSymbolMap.set(s, value);
            return s;
        }
    }

    /**
     * Adds the given properties as properties of the global object.
     * @param props The map of property names and values.
     */
    addGlobalProperties(props: Map<string, any | Value | Completion<Value>>) {
        this.realm.scope(() => {
            for (let [name, value] of props) {
                const copyResult = this.copyToValue(value);
                if (copyResult.Type !== 'normal') {
                    throw this.copyFromValue(copyResult.Value);
                }

                CreateDataProperty(
                    this.realm.GlobalObject,
                    new Value(name),
                    copyResult.Value
                );
            }
        });
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
}

// function mapErrorLineNumbers(
//     error: Error,
//     mapper: (
//         lineNumber: number,
//         fileName: string,
//         functionName: string
//     ) => number
// ) {
//     let stackFrames = ErrorStackParser.parse(error);

//     let newFrames = stackFrames.map((frame) => {
//         if (!('lineNumber' in frame) || typeof frame.lineNumber !== 'number') {
//             let keys = Object.keys(frame);

//             if (keys.length === 1 && keys[0] === 'functionName') {
//                 return null;
//             } else if (
//                 keys.length === 2 &&
//                 keys.includes('fileName') &&
//                 keys.includes('source')
//             ) {
//                 return null;
//             }

//             return frame;
//         }
//         let newLineNumber = mapper(
//             frame.lineNumber,
//             frame.fileName,
//             frame.functionName
//         );
//         if (newLineNumber === frame.lineNumber) {
//             return frame;
//         }

//         return new StackFrame({
//             fileName: frame.fileName,
//             functionName: frame.functionName,
//             lineNumber: newLineNumber,
//             columnNumber: frame.columnNumber,
//         });
//     });

//     const stack = newFrames
//         .filter((frame) => !!frame)
//         .map((frame) => '  at ' + frame.toString())
//         .join('\n');

//     return error.toString() + '\n' + stack;
// }

// function transformErrorLineNumbers(error: Error, functionName: string) {
//     let newStack = mapErrorLineNumbers(
//         error,
//         (lineNumber, fileName, funcName) =>
//             fileName === functionName || funcName === functionName
//                 ? lineNumber - 1
//                 : lineNumber
//     );
//     (error as any).oldStack = error.stack;
//     error.stack = newStack;
// }

export interface ConstructedFunction {
    module: SourceTextModuleRecord;
    func: ObjectValue;
    name: string;
}

const CONSTRUCTED_FUNCTION = Symbol('CONSTRUCTED_FUNCTION');

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

    /**
     * Whether the breakpoint is disabled.
     * Defaults to false.
     */
    disabled?: boolean;
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
    AwaitExpression: ['UnaryExpression'],
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
    if (!node) {
        throw new Error('Cannot traverse null nodes.');
    }
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

export type VisitorOption = null | void | 'skip';

export interface VisitedNode {
    node: ECMAScriptNode;
    parent: VisitedNode;
    key: string;
    depth: number;
}
