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
import type {
    DenialReason,
    GenericHttpResponse,
    KnownErrorCodes,
} from '@casual-simulation/aux-common';
import type {
    SpanOptions,
    MetricOptions as OTMetricOptions,
    Attributes,
} from '@opentelemetry/api';
import { SpanStatusCode, trace, metrics } from '@opentelemetry/api';
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

    /**
     * A function that gets the attributes for the metric.
     * @param args The arguments that were passed to the method.
     * @param ret The return value of the method.
     */
    attributes?: (args: any[], ret: any) => Attributes;
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
            const startTime = histogram ? Date.now() : null;
            const _this = this;
            return tracer.startActiveSpan(propertyKey, options, (span) => {
                try {
                    const ret = originalMethod.apply(_this, args);
                    if (ret instanceof Promise) {
                        return ret.then(
                            (result) => {
                                span.end();
                                if (histogram && startTime) {
                                    const endTime = Date.now();
                                    histogram.record(
                                        endTime - startTime,
                                        metricOptions.histogram?.attributes?.(
                                            args,
                                            result
                                        )
                                    );
                                }

                                counter?.add(
                                    1,
                                    metricOptions.counter?.attributes?.(
                                        args,
                                        result
                                    )
                                );

                                return result;
                            },
                            (err) => {
                                errorCounter?.add(
                                    1,
                                    metricOptions.errorCounter?.attributes?.(
                                        args,
                                        err
                                    )
                                );
                                span.recordException(err);
                                span.setStatus({ code: SpanStatusCode.ERROR });
                                throw err;
                            }
                        );
                    } else {
                        span.end();
                        const endTime = Date.now();
                        if (histogram && startTime) {
                            histogram?.record(
                                endTime - startTime,
                                metricOptions.histogram?.attributes?.(args, ret)
                            );
                        }
                        return ret;
                    }
                } catch (err) {
                    errorCounter?.add(
                        1,
                        metricOptions.errorCounter?.attributes?.(args, err)
                    );
                    if (err instanceof Error) {
                        span.recordException(err);
                    }
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
function getHistogram(meter: MeterConfig | null | undefined) {
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

function getCounter(meter: MeterConfig | null | undefined) {
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
     * The counter that should be incremented when a response is returned.
     */
    counter?: MeterConfig;
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
