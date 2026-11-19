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
import type { IncomingMessage } from 'node:http';
import type { Express, Request } from 'express';
import express from 'express';

/**
 * Resolve upgrade requests with Express's IP getter and the HTTP app's compiled
 * trust-proxy policy. WebSocket upgrades bypass Express request initialization.
 * Keep the original request untouched and never trust forwarded headers alone.
 */
export function getWebsocketClientIp(
    request: IncomingMessage,
    app: Express
): string | undefined {
    const proxyRequest = Object.create(express.request) as Request;
    Object.assign(proxyRequest, {
        app,
        connection: request.socket,
        headers: request.headers,
    });
    return proxyRequest.ip;
}
