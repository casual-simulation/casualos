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
import type { KnownErrorCodes } from '@casual-simulation/aux-common';

/**
 * A map of ISO4217 alphabetic currency codes to their numeric codes
 * and minor units
 * * Last updated: 2024-08-30 (YYYY-MM-DD)
 */
export type ISO4217_Map = {
    AED: { n: 784; mU: 2 };
    AFN: { n: 971; mU: 2 };
    ALL: { n: 8; mU: 2 };
    AMD: { n: 51; mU: 2 };
    ANG: { n: 532; mU: 2 };
    AOA: { n: 973; mU: 2 };
    ARS: { n: 32; mU: 2 };
    AUD: { n: 36; mU: 2 };
    AWG: { n: 533; mU: 2 };
    AZN: { n: 944; mU: 2 };
    BAM: { n: 977; mU: 2 };
    BBD: { n: 52; mU: 2 };
    BDT: { n: 50; mU: 2 };
    BGN: { n: 975; mU: 2 };
    BHD: { n: 48; mU: 3 };
    BIF: { n: 108; mU: 0 };
    BMD: { n: 60; mU: 2 };
    BND: { n: 96; mU: 2 };
    BOB: { n: 68; mU: 2 };
    BOV: { n: 984; mU: 2 };
    BRL: { n: 986; mU: 2 };
    BSD: { n: 44; mU: 2 };
    BTN: { n: 64; mU: 2 };
    BWP: { n: 72; mU: 2 };
    BYN: { n: 933; mU: 2 };
    BZD: { n: 84; mU: 2 };
    CAD: { n: 124; mU: 2 };
    CDF: { n: 976; mU: 2 };
    CHE: { n: 947; mU: 2 };
    CHF: { n: 756; mU: 2 };
    CHW: { n: 948; mU: 2 };
    CLF: { n: 990; mU: 4 };
    CLP: { n: 152; mU: 0 };
    CNY: { n: 156; mU: 2 };
    COP: { n: 170; mU: 2 };
    COU: { n: 970; mU: 2 };
    CRC: { n: 188; mU: 2 };
    CUC: { n: 931; mU: 2 };
    CUP: { n: 192; mU: 2 };
    CVE: { n: 132; mU: 2 };
    CZK: { n: 203; mU: 2 };
    DJF: { n: 262; mU: 0 };
    DKK: { n: 208; mU: 2 };
    DOP: { n: 214; mU: 2 };
    DZD: { n: 12; mU: 2 };
    EGP: { n: 818; mU: 2 };
    ERN: { n: 232; mU: 2 };
    ETB: { n: 230; mU: 2 };
    EUR: { n: 978; mU: 2 };
    FJD: { n: 242; mU: 2 };
    FKP: { n: 238; mU: 2 };
    GBP: { n: 826; mU: 2 };
    GEL: { n: 981; mU: 2 };
    GHS: { n: 936; mU: 2 };
    GIP: { n: 292; mU: 2 };
    GMD: { n: 270; mU: 2 };
    GNF: { n: 324; mU: 0 };
    GTQ: { n: 320; mU: 2 };
    GYD: { n: 328; mU: 2 };
    HKD: { n: 344; mU: 2 };
    HNL: { n: 340; mU: 2 };
    HTG: { n: 332; mU: 2 };
    HUF: { n: 348; mU: 2 };
    IDR: { n: 360; mU: 2 };
    ILS: { n: 376; mU: 2 };
    INR: { n: 356; mU: 2 };
    IQD: { n: 368; mU: 3 };
    IRR: { n: 364; mU: 2 };
    ISK: { n: 352; mU: 0 };
    JMD: { n: 388; mU: 2 };
    JOD: { n: 400; mU: 3 };
    JPY: { n: 392; mU: 0 };
    KES: { n: 404; mU: 2 };
    KGS: { n: 417; mU: 2 };
    KHR: { n: 116; mU: 2 };
    KMF: { n: 174; mU: 0 };
    KPW: { n: 408; mU: 2 };
    KRW: { n: 410; mU: 0 };
    KWD: { n: 414; mU: 3 };
    KYD: { n: 136; mU: 2 };
    KZT: { n: 398; mU: 2 };
    LAK: { n: 418; mU: 2 };
    LBP: { n: 422; mU: 2 };
    LKR: { n: 144; mU: 2 };
    LRD: { n: 430; mU: 2 };
    LSL: { n: 426; mU: 2 };
    LYD: { n: 434; mU: 3 };
    MAD: { n: 504; mU: 2 };
    MDL: { n: 498; mU: 2 };
    MGA: { n: 969; mU: 2 };
    MKD: { n: 807; mU: 2 };
    MMK: { n: 104; mU: 2 };
    MNT: { n: 496; mU: 2 };
    MOP: { n: 446; mU: 2 };
    MRU: { n: 929; mU: 2 };
    MUR: { n: 480; mU: 2 };
    MVR: { n: 462; mU: 2 };
    MWK: { n: 454; mU: 2 };
    MXN: { n: 484; mU: 2 };
    MXV: { n: 979; mU: 2 };
    MYR: { n: 458; mU: 2 };
    MZN: { n: 943; mU: 2 };
    NAD: { n: 516; mU: 2 };
    NGN: { n: 566; mU: 2 };
    NIO: { n: 558; mU: 2 };
    NOK: { n: 578; mU: 2 };
    NPR: { n: 524; mU: 2 };
    NZD: { n: 554; mU: 2 };
    OMR: { n: 512; mU: 3 };
    PAB: { n: 590; mU: 2 };
    PEN: { n: 604; mU: 2 };
    PGK: { n: 598; mU: 2 };
    PHP: { n: 608; mU: 2 };
    PKR: { n: 586; mU: 2 };
    PLN: { n: 985; mU: 2 };
    PYG: { n: 600; mU: 0 };
    QAR: { n: 634; mU: 2 };
    RON: { n: 946; mU: 2 };
    RSD: { n: 941; mU: 2 };
    RUB: { n: 643; mU: 2 };
    RWF: { n: 646; mU: 0 };
    SAR: { n: 682; mU: 2 };
    SBD: { n: 90; mU: 2 };
    SCR: { n: 690; mU: 2 };
    SDG: { n: 938; mU: 2 };
    SEK: { n: 752; mU: 2 };
    SGD: { n: 702; mU: 2 };
    SHP: { n: 654; mU: 2 };
    SLE: { n: 925; mU: 2 };
    SOS: { n: 706; mU: 2 };
    SRD: { n: 968; mU: 2 };
    SSP: { n: 728; mU: 2 };
    STN: { n: 930; mU: 2 };
    SVC: { n: 222; mU: 2 };
    SYP: { n: 760; mU: 2 };
    SZL: { n: 748; mU: 2 };
    THB: { n: 764; mU: 2 };
    TJS: { n: 972; mU: 2 };
    TMT: { n: 934; mU: 2 };
    TND: { n: 788; mU: 3 };
    TOP: { n: 776; mU: 2 };
    TRY: { n: 949; mU: 2 };
    TTD: { n: 780; mU: 2 };
    TWD: { n: 901; mU: 2 };
    TZS: { n: 834; mU: 2 };
    UAH: { n: 980; mU: 2 };
    UGX: { n: 800; mU: 0 };
    USD: { n: 840; mU: 2 };
    USN: { n: 997; mU: 2 };
    UYI: { n: 940; mU: 0 };
    UYU: { n: 858; mU: 2 };
    UYW: { n: 927; mU: 4 };
    UZS: { n: 860; mU: 2 };
    VED: { n: 926; mU: 2 };
    VES: { n: 928; mU: 2 };
    VND: { n: 704; mU: 0 };
    VUV: { n: 548; mU: 0 };
    WST: { n: 882; mU: 2 };
    XAF: { n: 950; mU: 0 };
    XAG: { n: 961; mU: null };
    XAU: { n: 959; mU: null };
    XBA: { n: 955; mU: null };
    XBB: { n: 956; mU: null };
    XBC: { n: 957; mU: null };
    XBD: { n: 958; mU: null };
    XCD: { n: 951; mU: 2 };
    XDR: { n: 960; mU: null };
    XOF: { n: 952; mU: 0 };
    XPD: { n: 964; mU: null };
    XPF: { n: 953; mU: 0 };
    XPT: { n: 962; mU: null };
    XSU: { n: 994; mU: null };
    XTS: { n: 963; mU: null };
    XUA: { n: 965; mU: null };
    XXX: { n: 999; mU: null };
    YER: { n: 886; mU: 2 };
    ZAR: { n: 710; mU: 2 };
    ZMW: { n: 967; mU: 2 };
    ZWG: { n: 924; mU: 2 };
    ZWL: { n: 932; mU: 2 };
};

/**
 * A Generic utility type that parses a type's keys and properties from
 * sub-objects into an array of arrays each containing each key and
 * its requested properties
 * @template U The root type
 * @template A An array of properties to extract from each key (U[T]) in U
 * @template T Used to force union effects on all keys, please do not override
 * ? What is KASP? An acronym for Keys And Specified Properties :)
 * @example
 * type X = {
 *    a: { x: 'String literal'; y: number, z: boolean };
 *    b: { x: string; y: number, z: boolean };
 * };
 * type Y = ArrayOfKASP<X, ['x','y']>;
 * // [['a','String literal','number'],['b','string','number']]
 */
export type ArrayOfKASP<
    U,
    A extends Array<keyof U[T]>,
    T extends keyof U = keyof U
> = Array<
    T extends keyof U
        ? [
              T,
              ...{
                  [K in keyof A]: A[K] extends keyof U[T] ? U[T][A[K]] : never;
              }
          ]
        : never
>;

/**
 * A Generic utility type which returns the opposite of the extends operator (!extends)
 * @template T The type to check if it does not extend U
 * @template U The type to check if T does not extend it
 */
export type NotExtends<T, U> = T extends U ? false : true;

/**
 * A Generic utility type which return the specified properties of a type
 * @template T The type to extract properties from
 * @template Keys The keys to extract from T
 */
export type PropertiesOf<T, K extends keyof T> = {
    [Key in K]: T[K];
}[K];

/**
 * A Generic utility type which converts a union of keys
 * to another union of keys which conform to the paradigm `${P}${Key}${S}`
 * @template T The Union of keys to apply the prefix/suffix to
 * @template P The prefix to apply to each key
 * @template S The suffix to apply to each key
 * @template A A boolean flag to determine whether to apply the prefix/suffix or remove it
 * @template C A boolean flag to determine whether to capitalize / uncapitalize the key
 * @example
 * type UnionToAlias = 'keyX' | 'keyY' | 'keyZ';
 * type Aliased = AliasUnion<UnionToAlias, 'omit'>; // "omitKeyX" | "omitKeyY" | "omitKeyZ"
 * type De_Aliased = AliasUnion<Aliased, 'omit', '', false>; // "keyX" | "keyY" | "keyZ"
 */
export type AliasUnion<
    T extends string,
    P extends string = '_',
    S extends string = '',
    A extends boolean = true,
    C extends boolean = true
> = A extends true
    ? T extends string
        ? `${P}${Capitalize<T>}${S}`
        : never
    : T extends string & `${P}${infer Key}${S}`
    ? C extends true
        ? Uncapitalize<Key>
        : Key
    : never;

/**
 * A Generic utility type which maps original keys to aliased keys
 * @template T The union of strings to map to aliases
 * @template P The prefix to apply to each key
 * @template S The suffix to apply to each key
 * @template R A boolean flag to determine whether to reverse the mapping (true = original to alias)
 * @example
 * type UnionToAlias = 'keyX' | 'keyY' | 'keyZ';
 * type AliasM = AliasMap<UnionToAlias, 'omit'>; // { "omitKeyX": "keyX", "omitKeyY": "keyY", "omitKeyZ": "keyZ" }
 * type ReverseAliasM = AliasMap<UnionToAlias, 'omit', '', true>; //  { "keyX": "omitKeyX", "keyY": "omitKeyY", "keyZ": "omitKeyZ" }
 */
export type AliasMap<
    T extends string,
    P extends string = '_',
    S extends string = '',
    R extends boolean = false
> = R extends true
    ? { [K in T]: AliasUnion<K, P, S> }
    : { [A in AliasUnion<T, P, S>]: AliasUnion<A, P, S, false> };

/**
 * A Generic utility type which allows a value to be either itself or null
 * @template T The type to make nullable
 */
export type Nullable<T> = T | null;

export type NotNullOrOptional<T> = {
    [K in keyof T]-?: Exclude<T[K], null>;
};

/**
 * A Generic utility type which flattens arrays into unions containing the array's elements
 * @template T The type to flatten (can contain non-array types which will be included in the returned union)
 * @example
 * type X = FlattenUnion<[1,2,3]>; // 1 | 2 | 3
 * type Y = FlattenUnion<[1,2,3] | 'a' | 'b'>; // 1 | 2 | 3 | 'a' | 'b'
 */
export type FlattenUnion<T> = T extends Array<infer U> ? U : T;

/**
 * A Generic utility type which forms a union of the values of a given type
 * * Is not inherently recursive, will only extract the first level of keys
 * @template T The type to extract values from
 * @example
 * type X = { a: 1; b: 2; c: 3 };
 * type Y = UnionOfTValues<X>; // 1 | 2 | 3
 */
export type UnionOfTValues<T, K = keyof T> = K extends keyof T ? T[K] : never;

/** Provides an extensible interface for commonly used Date markers */
export interface GenericTimeKeys {
    /** The date at which the entity was created */
    createdAtMs: DateMS;
    /** The date at which the entity was last updated */
    updatedAtMs: DateMS;
}

/** Provides an extensible interface for commonly used Date markers used by the database (prisma) */
export interface GenericTimeKeysDB {
    /** The date at which the entity was created */
    createdAt: Date;
    /** The date at which the entity was last updated */
    updatedAt: Date;
}

/**
 * A Generic utility type which switches the time keys of a type M to either GenericTimeKeys or GenericTimeKeysDB
 */
export type UseTimeKeys<
    M,
    Expects = GenericTimeKeys | GenericTimeKeysDB
> = Expects extends GenericTimeKeysDB
    ? Omit<M, keyof GenericTimeKeys> & GenericTimeKeysDB
    : Omit<M, keyof GenericTimeKeysDB> & GenericTimeKeys;

/**
 * A Generic utility type which effectively coerces type T to its primitive counterpart
 */
export type RootType<T> = T extends string
    ? string
    : T extends number
    ? number
    : T extends boolean
    ? boolean
    : T extends bigint
    ? bigint
    : T extends symbol
    ? symbol
    : T extends null
    ? null
    : T extends undefined
    ? undefined
    : T extends object
    ? T extends Array<infer U>
        ? RootType<U>[]
        : T
    : never;

/**
 * A Generic utility type which expands the functionality of RootType to unions
 */
export type ReduceUnion<T> = T extends any ? RootType<T> : never;

/**
 * A Generic utility type which reduces the keys of a type T to their primitive types
 * * This is useful for converting complex types to their primitive counterparts
 * @template T The type to reduce the keys of
 * @example
 * type X = { a: { x: 'literal0' | 'literal1'; y: 0 | 5, z: true | false }; b: { x: string; y: number, z: boolean } };
 * type Y = ReduceKeysToPrimitives<X>; // { a: { x: string; y: number, z: boolean }; b: { x: string; y: number, z: boolean } }
 */
export type ReduceKeysToPrimitives<T> = {
    [K in keyof T]: ReduceUnion<T[K]>;
};

/**
 * A Generic utility type which extracts id's as a union of their keys from a given type T
 * @template T The type to extract id's from
 * @template S The suffix to search for in the keys of T, defaults to 'Id'
 * @template X The keys of T to search for, defaults to all keys of T
 */
export type IdStrIn<
    T,
    S extends string = 'Id',
    X extends keyof T = keyof T
> = X extends `${infer _}${S}` | 'id' ? X : never;

/**
 * A Generic utility type which extracts id's from a given type T
 * @template T The type to extract id's from
 */
export type IdIn<T> = Pick<T, IdStrIn<T>>;

/** A type alias for a number, that should only represent time in milliseconds */
export type DateMS = number;
/** A type alias for a number, that should only represent a quantity of gigs (6 minute intervals of work)  */
export type GigQty = number;
/** A type alias for a number, that should only represent a quantity of a currency in its smallest fractional unit (E.G. cents in USD) */
export type CurrencySFU = number;

/**
 * A Generic utility type which compares a type to "never" providing a boolean representation as to whether or not
 * the aforementioned type is "never"
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * A Generic utility type which extracts the property on type T at K when K is a key of T;
 * but does not constrain K to be a key of T
 * @template T The type to extract the property from
 * @template K The key to extract the property at
 * @example
 * type X = { a: 1; b: 2; c: 3 };
 * type Y = KNever<X, 'a'>; // 1
 * type Z = KNever<X, 'd'>; // never
 */
export type KNever<T, K> = K extends keyof T ? T[K] : never;

/**
 * A Generic utility type which extracts from S keys which are present in P
 * @template P The type which contains the keys to extract from S if they are present
 * @template S The type to extract keys from
 * @example
 * type P = 'a' | 'b' | 'c';
 * type S = 'b' | 'c' | 'd';
 * type X = ExtractKeys<P, S>; // 'b' | 'c'
 */
export type OfPUnion<P, S> = S extends P ? S : never;

/**
 * A Generic utility type which represents either T or a Promise of T
 * @template T The type to represent as a Promise or an immediate value of
 */
export type PromiseOrValue<T> = T | Promise<T>;

/**
 * A niched utility type which performs the core advertised functionality of ProviderIfInHost, and
 * converts type E to a type which provides values which are members of Host H
 * @template E The (entity) type to convert
 * @template H The (host) type which contains types that should be converted to provider functions
 */
export type EntityProvider<E, H, P extends keyof E = keyof E> = {
    [K in P]: E[K] extends UnionOfTValues<H>
        ? (...args: any) => PromiseOrValue<ProviderIfInHost<E[K], H>>
        : E[K] extends UnionOfTValues<H>[]
        ? ProviderIfInHost<E[K], H>
        : E[K];
};

/**
 * A Generic utility type which converts a type to a type which provides values
 * which are members of Host H (provider functions).
 * * Useful for preventing direct recursive access to members which are described by the host
 * @template T The type to convert
 * @template H The host type which contains types that should be converted to provider functions
 */
export type ProviderIfInHost<T, H> = T extends Array<any>
    ? (...args: any) => PromiseOrValue<{
          [K in keyof T]: EntityProvider<T[K], H>;
      }>
    : EntityProvider<T, H>;

/**
 * An abstract type which represents a "model" host, a niched type, grouping types which may reference each other
 * @template T A type which contains types that may be self-referential (from the host context)
 * @example
 * type X = ModelHost<{
 *   a: { x: 'String literal'; y: number, z: boolean }; // Target within host X
 *   b: X['a'][]; // Self-referential property of host X
 * }>;
 *
 */
export type ModelHost<T extends Record<keyof any, unknown>> = T;

/**
 * A Generic utility type which extracts the keys of a type T which are present in a type H
 */
export type StoreOfModel<
    M extends ModelHost<any>,
    A extends keyof any
> = A extends keyof any ? keyof M : never;
// TODO: Complete the implementation of the StoreOfModel type, should return a record of keys in M which are modified by each union A member

/**
 * A Generic utility type which allows for extensible Action results to be defined with a success state
 * @template S The success state of the action
 * @template T The type of the result to be included in the action result
 */
export type ActionResult_T<S extends boolean, T extends object> = {
    /** The result success state of the action */
    success: S;
} & T;

/**
 * A Generic utility type which represents an action result with a success state and a result
 * @template S The success state of the action
 * @template T The type of the result to be included in the action result
 */
export type StatefulResult<
    S extends boolean = true | false,
    T extends object = S extends true
        ? object
        : {
              /** The error code */
              errorCode: KnownErrorCodes;
              /** The error message */
              errorMessage?: string;
          }
> = ActionResult_T<S, T>;

export type SuccessResult = StatefulResult<true, object>;

export type FailedResult = StatefulResult<
    false,
    { errorCode: KnownErrorCodes; errorMessage: string }
>;

/**
 * A Generic utility type which represents data in a manner which is safe for JSON serialization
 */
export type SafeJSONSerializable<T, K extends keyof T = keyof T> = {
    [Key in K]: T[Key] extends object
        ? SafeJSONSerializable<T[Key]>
        : T[Key] extends Date | bigint
        ? string
        : T[Key] extends  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
              | Function
              | symbol
              | undefined
              | Map<any, any>
              | Set<any>
        ? never
        : T[Key];
};

/**
 * A Generic Promise utility type which extracts the type of a promise's resolved value
 * @template T The type of the promise to extract the resolved value from
 */
export type PromiseT<T> = T extends Promise<infer U> ? U : T;

/**
 * A Generic utility type which extracts the keys of a type T which are not present in a type U
 * @template T The type to extract keys from
 * @template U The type to exclude keys from T
 */
export type Without<T, U> = { [K in Exclude<keyof T, keyof U>]?: never };

/**
 * A Generic utility type which represents an exclusive OR between two types
 * @template T The first type
 * @template U The second type
 * @template B An optional base type to extend from
 */
export type XOR<T, U, B = object> = B &
    ((T & Without<U, T>) | (U & Without<T, U>));
