import {
    DenialReason,
    GenericHttpResponse,
    KnownErrorCodes,
} from '@casual-simulation/aux-common';
import {
    Counter,
    Histogram,
    SpanKind,
    SpanOptions,
    SpanStatusCode,
    trace,
    MetricOptions as OTMetricOptions,
    metrics,
    Meter,
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

export interface MeterConfig {
    /**
     * The name of the meter.
     */
    meter: string;

    /**
     * The name of the histogram.
     */
    name: string;

    /**
     * The options.
     */
    options: OTMetricOptions;
}

/**
 * The options for the metric that is created.
 */
export interface MetricOptions {
    /**
     * The histogram that method durations should be recorded to.
     */
    histogram?: MeterConfig;

    /**
     * The counter that should be incremented when the method is called.
     */
    counter?: MeterConfig;

    /**
     * The counter that should be incremented when the method throws an error.
     */
    errorCounter?: MeterConfig;
}

/**
 * Modifies the given method so that it is traced.
 * @param tracerName The name of the tracer that the method spans should be created for.
 * @param options The options for the spans that are created.
 * @param metricOptions The options for recording metrics.
 */
export function traced(
    tracerName: string,
    options: SpanOptions = {},
    metricOptions: MetricOptions = {}
) {
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
            const histogram = getHistogram(metricOptions.histogram);
            const counter = getCounter(metricOptions.counter);
            const errorCounter = getCounter(metricOptions.errorCounter);
            const startTime = Date.now();
            const _this = this;
            return tracer.startActiveSpan(propertyKey, options, (span) => {
                try {
                    counter?.add(1);
                    const ret = originalMethod.apply(_this, args);
                    if (ret instanceof Promise) {
                        return ret.then(
                            (result) => {
                                span.end();
                                const endTime = Date.now();
                                histogram?.record(endTime - startTime);
                                return result;
                            },
                            (err) => {
                                errorCounter?.add(1);
                                span.recordException(err);
                                span.setStatus({ code: SpanStatusCode.ERROR });
                                throw err;
                            }
                        );
                    } else {
                        span.end();
                        const endTime = Date.now();
                        histogram?.record(endTime - startTime);
                        return ret;
                    }
                } catch (err) {
                    errorCounter?.add(1);
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
 * Gets the histogram for the given meter config.
 * @param meter The meter config.
 */
function getHistogram(meter: MeterConfig) {
    if (!meter) {
        return null;
    }
    return metrics
        .getMeter(
            meter.meter,
            typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG
        )
        .createHistogram(meter.name, meter.options);
}

function getCounter(meter: MeterConfig) {
    if (!meter) {
        return null;
    }
    return metrics
        .getMeter(
            meter.meter,
            typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG
        )
        .createCounter(meter.name, meter.options);
}

/**
 * The options for the metrics that should be recorded for the HTTP response.
 */
export interface HttpResponseMetricOptions {
    /**
     * The counter that should be incremented when the response has a 2xx status code.
     */
    _2xxCounter?: MeterConfig;

    /**
     * The counter that should be incremented when the response has a 3xx status code.
     */
    _3xxCounter?: MeterConfig;

    /**
     * The counter that should be incremented when the response has a 4xx status code.
     */
    _4xxCounter?: MeterConfig;

    /**
     * The counter that should be incremented when the response has a 5xx status code.
     */
    _5xxCounter?: MeterConfig;
}

/**
 * Modifies the given method so that information about the HTTP response is added to the active span.
 * This should be used on methods that return a GenericHttpResponse.
 * @param options The options for the metrics that should be recorded for the HTTP response.
 */
export function traceHttpResponse(options: HttpResponseMetricOptions = {}) {
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

            const _2xxCounter = getCounter(options._2xxCounter);
            const _3xxCounter = getCounter(options._3xxCounter);
            const _4xxCounter = getCounter(options._4xxCounter);
            const _5xxCounter = getCounter(options._5xxCounter);
            if (
                _2xxCounter &&
                response.statusCode >= 200 &&
                response.statusCode < 300
            ) {
                _2xxCounter.add(1);
            } else if (
                _3xxCounter &&
                response.statusCode >= 300 &&
                response.statusCode < 400
            ) {
                _3xxCounter.add(1);
            } else if (
                _4xxCounter &&
                response.statusCode >= 400 &&
                response.statusCode < 500
            ) {
                _4xxCounter.add(1);
            } else if (_5xxCounter && response.statusCode >= 500) {
                _5xxCounter.add(1);
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
