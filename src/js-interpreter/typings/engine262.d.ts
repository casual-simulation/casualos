declare module '@casual-simulation/engine262' {
    import type { Node } from 'estree';

    export function setSurroundingAgent(agent: Agent): void;
    export let surroundingAgent: Agent;
    export function inspect(value: Value): string;

    export function CreateDataProperty(
        obj: ObjectValue,
        name: Value,
        value: Value
    ): void;

    export class Value {
        static undefined: UndefinedValue;
        static null: NullValue;
        static true: BooleanValue;
        static false: BooleanValue;
        constructor(value?: string | number | bigint | Function);
    }

    export class BooleanValue extends Value {
        boolean: boolean;
        constructor(value: boolean);
    }

    export class StringValue extends Value {
        string: string;
        constructor(string: string);
    }

    export class UndefinedValue extends Value {}
    export class NullValue extends Value {}

    export class ObjectValue extends Value {}

    export interface AgentOptions {
        onDebugger?(): void;
        yieldEachNode?: boolean;
    }

    export class Agent {
        currentRealmRecord: ManagedRealm;
        constructor(options: AgentOptions);
    }

    export interface ManagedRealmOptions {
        promiseRejectionTracker?(): void;
        resolveImportedModule?(): void;
        randomSeed?(): void;
    }

    export class ManagedRealm {
        GlobalObject: ObjectValue;

        constructor(options: ManagedRealmOptions);

        scope(func: () => void): void;

        evaluateScript(script: string): void;
    }

    export class ExecutionContext {
        Realm: ManagedRealm;
        Function: ObjectValue;
        ScriptOrModule: ScriptRecord;
        // VariableEnvironment:
    }

    export interface ScriptRecord {
        Realm: ManagedRealm;
        ECMAScriptCode: Node;
        HostDefined: any;
    }

    export class Completion {
        Type: 'throw' | 'normal';
        Value: any;
        Target: any;
    }

    export function ParseScript(
        sourceText: string,
        realm: ManagedRealm,
        hostDefined: any
    ): ScriptRecord | any[];

    export function ThrowCompletion(argument: any): Completion;
    export function EnsureCompletion(argument: any): Completion;
    export function NormalCompletion(argument: any): Completion;

    export function unwind(iterator: Iterable<any>, maxSteps?: number): any;

    export function Evaluate(node: Node): IterableIterator<any>;

    export function GlobalDeclarationInstantiation(script: any, env: any): any;
}
