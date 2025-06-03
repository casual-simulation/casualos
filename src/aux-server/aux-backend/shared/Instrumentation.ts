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
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import {
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import {
    SEMRESATTRS_SERVICE_NAME,
    SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import type { ServerConfig } from '@casual-simulation/aux-records';

/**
 * Configures instrumentation for a server.
 * @param config The configuration that should be used.
 */
export function setupInstrumentation(options: ServerConfig) {
    if (!options.telemetry) {
        return;
    }
    console.log(`[Instrumentation] Using telemetry.`);

    console.log(
        `[Instrumentation] Tracing Configuration:`,
        options.telemetry.tracing
    );

    const traceExporter =
        options.telemetry.tracing.exporter === 'console'
            ? new ConsoleSpanExporter()
            : options.telemetry.tracing.exporter === 'otlp'
            ? new OTLPTraceExporter({
                  url: options.telemetry.tracing.url,
                  headers: options.telemetry.tracing.headers,
              })
            : null;

    console.log(
        `[Instrumentation] Metrics Configuration:`,
        options.telemetry.metrics
    );

    const metrics =
        options.telemetry.metrics.exporter === 'none'
            ? null
            : new PeriodicExportingMetricReader({
                  exporter:
                      options.telemetry.metrics.exporter === 'console'
                          ? new ConsoleMetricExporter()
                          : options.telemetry.metrics.exporter === 'otlp'
                          ? new OTLPMetricExporter({
                                url: options.telemetry.metrics.url,
                                headers: options.telemetry.metrics.headers,
                            })
                          : null,
              });

    console.log(
        `[Instrumentation] Instrumentation Configuration:`,
        options.telemetry.instrumentation
    );

    const instrumentation: any[] = [];

    if (options.telemetry.instrumentation.auto) {
        console.log(
            `[Instrumentation] Using auto instrumentation with config:`,
            options.telemetry.instrumentation.auto
        );
        instrumentation.push(
            getNodeAutoInstrumentations(options.telemetry.instrumentation.auto)
        );
    } else if (typeof options.telemetry.instrumentation.auto === 'undefined') {
        console.log(`[Instrumentation] Using auto instrumentation.`);
        instrumentation.push(getNodeAutoInstrumentations());
    } else {
        console.log(`[Instrumentation] Skipping auto instrumentation.`);
    }

    if (options.telemetry.instrumentation.prisma) {
        console.log(
            `[Instrumentation] Using Prisma instrumentation with config:`,
            options.telemetry.instrumentation.prisma
        );
        instrumentation.push(
            new PrismaInstrumentation(options.telemetry.instrumentation.prisma)
        );
    } else if (
        typeof options.telemetry.instrumentation.prisma === 'undefined'
    ) {
        console.log(`[Instrumentation] Using Prisma instrumentation.`);
        instrumentation.push(new PrismaInstrumentation());
    } else {
        console.log(`[Instrumentation] Skipping Prisma instrumentation.`);
    }

    const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'casualos',
        [SEMRESATTRS_SERVICE_VERSION]: GIT_TAG || 'dev',
        ...options.telemetry.resource,
    });

    const sdk = new NodeSDK({
        resource,
        traceExporter: traceExporter,
        metricReader: metrics,
        instrumentations: instrumentation,
    });

    sdk.start();
}
