declare module '@engine262/engine262' {
    import type { Node } from 'estree';

    export function setSurroundingAgent(agent: Agent): void;
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
        constructor(value?: string | number | bigint | function);
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

    export interface ScriptRecord {
        Realm: ManagedRealm;
        ECMAScriptCode: Node;
        HostDefined: any;
    }

    export function ParseScript(
        sourceText: string,
        realm: ManagedRealm,
        hostDefined: any
    ): ScriptRecord;
}
