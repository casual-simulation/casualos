import {
    DenialReason,
    GenericHttpResponse,
    KnownErrorCodes,
} from '@casual-simulation/aux-common';
import {
    SpanKind,
    SpanOptions,
    SpanStatusCode,
    trace,
} from '@opentelemetry/api';
import { SEMATTRS_HTTP_STATUS_CODE } from '@opentelemetry/semantic-conventions';

declare const GIT_TAG: string;

// /**
//  * Modifies the given class so that each function is traced.
//  * @param tracerName The name of the tracer that the method spans should be created for.
//  */
// export function addTracingToClass(tracerName: string) {

//     return function <T extends { new (...args: any[]): {} }>(constructor: T) {
//         console.log('Adding tracing to class', tracerName);
//         for(let prop in constructor.prototype) {
//             if (typeof constructor.prototype[prop] === 'function') {
//                 const descriptor = traced(tracerName)(constructor.prototype, prop, {
//                     value: constructor.prototype[prop]
//                 });
//                 if (descriptor.value) {
//                     constructor.prototype[prop] = descriptor.value;
//                     // Object.defineProperty(constructor.prototype, prop, descriptor);
//                 }
//             }
//         }
//     }

//     // return function <T extends { new (...args: any[]): {} }>(constructor: T) {
//     //     return class extends constructor {
//     //         constructor(...args: any[]) {
//     //             super(...args);
//     //             for (let prop in this) {
//     //                 if (typeof this[prop] === 'function') {
//     //                     const descriptor = traced(tracerName)(this, prop, Object.getOwnPropertyDescriptor(this, prop));
//     //                     if (descriptor) {
//     //                         Object.defineProperty(this, prop, descriptor);
//     //                     }
//     //                 }
//     //             }
//     //         }
//     //     };
//     // };
// }

/**
 * Modifies the given method so that it is traced.
 * @param tracerName The name of the tracer that the method spans should be created for.
 * @param options The options for the spans that are created.
 */
export function traced(tracerName: string, options: SpanOptions = {}) {
    const tracer = trace.getTracer(
        tracerName,
        typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG
    );
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const _this = this;
            return tracer.startActiveSpan(propertyKey, options, (span) => {
                try {
                    const ret = originalMethod.apply(_this, args);
                    if (ret instanceof Promise) {
                        return ret.then(
                            (result) => {
                                span.end();
                                return result;
                            },
                            (err) => {
                                span.recordException(err);
                                span.setStatus({ code: SpanStatusCode.ERROR });
                                throw err;
                            }
                        );
                    } else {
                        span.end();
                        return ret;
                    }
                } catch (err) {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR });
                    throw err;
                }
            });
        };
        return descriptor;
    };
}

/**
 * Modifies the given method so that information about the HTTP response is added to the active span.
 * This should be used on methods that return a GenericHttpResponse.
 */
export function traceHttpResponse() {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const response: GenericHttpResponse = await originalMethod.apply(
                this,
                args
            );
            const span = trace.getActiveSpan();

            if (span) {
                span.setAttributes({
                    [SEMATTRS_HTTP_STATUS_CODE]: response.statusCode,
                });
            }

            return response;
        };
        return descriptor;
    };
}

/**
 * Modifies the given method so that information about the result object is added to the active span.
 * This should be used on methods that return a result object.
 */
export function traceResult() {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const result: {
                success: boolean;
                errorCode?: KnownErrorCodes;
                errorMessage?: string;
                reason?: DenialReason;
            } = await originalMethod.apply(this, args);
            const span = trace.getActiveSpan();

            if (span) {
                if (!result.success) {
                    span.setAttributes({
                        ['result.errorCode']: result.errorCode,
                        ['result.errorMessage']: result.errorMessage,
                    });

                    if (result.reason) {
                        for (let prop in result.reason) {
                            span.setAttribute(
                                `result.reason.${prop}`,
                                (result.reason as any)[prop] as string
                            );
                        }
                    }
                }
            }

            return result;
        };
        return descriptor;
    };
}
