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
} from '@casual-simulation/engine262';
import { unwind } from './InterpreterUtils';

/**
 * Defines a class that wraps common engine262 capabilities.
 */
export class Interpreter {
    private _symbolMap = new Map<Value, symbol>();

    /**
     * The agent that this interpreter is currently using.
     */
    agent: Agent;

    /**
     * The realm that this interpreter is using.
     */
    realm: ManagedRealm;

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
            throw new Error('Unable to parse module!');
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
     * Copies the given value into a regular JS object.
     * @param value The value that should be copied.
     */
    copyFromValue(value: Value): any {
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
                return this._getOrCreateSymbol(value as SymbolValue);
            case 'Object':
                return this._copyFromObject(value as ObjectValue);
            // case ''
        }
    }

    private _copyFromObject(value: ObjectValue): object {
        const proto = this._getObjectProto(value);
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

            obj[propName] = this.copyFromValue(propValue.Value);
        }

        return obj;
    }

    private _getObjectProto(value: ObjectValue) {
        let proto = value.GetPrototypeOf();
        while (Type(proto) === 'Object') {
            const builtinPrototypes = [
                ['%Object.prototype%', Object.prototype] as const,
                ['%Error.prototype%', Error.prototype] as const,
                ['%EvalError.prototype%', EvalError.prototype] as const,
                ['%RangeError.prototype%', RangeError.prototype] as const,
                [
                    '%ReferenceError.prototype%',
                    ReferenceError.prototype,
                ] as const,
                ['%SyntaxError.prototype%', SyntaxError.prototype] as const,
                ['%TypeError.prototype%', TypeError.prototype] as const,
                ['%URIError.prototype%', URIError.prototype] as const,
            ];

            for (let [key, prototype] of builtinPrototypes) {
                if (
                    SameValue(proto, this.realm.Intrinsics[key]) == Value.true
                ) {
                    return prototype;
                }
            }

            proto = (proto as ObjectValue).GetPrototypeOf();
        }

        return null;
    }

    private _getOrCreateSymbol(value: SymbolValue): symbol {
        if (this._symbolMap.has(value)) {
            return this._symbolMap.get(value);
        } else {
            const s = Symbol((value as any).Description);
            this._symbolMap.set(value, s);
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
}
