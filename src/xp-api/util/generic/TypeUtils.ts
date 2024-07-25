/**
 * Extracts the type of a promise.
 * Infers the generic type of a promise and returns it.
 */
export type ParsePromiseGeneric<T> = T extends Promise<infer U> ? U : never;
