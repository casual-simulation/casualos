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
import express from 'express';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { getWebsocketClientIp } from './WebsocketClientIp';

describe('WebSocket client IP', () => {
    it.each([
        ['default policy', undefined, '10.0.10.5', '198.51.100.1', '10.0.10.5'],
        ['disabled policy', false, '10.0.10.5', '198.51.100.1', '10.0.10.5'],
        [
            'trusted ALB',
            '10.0.10.0/24',
            '10.0.10.5',
            '198.51.100.1',
            '198.51.100.1',
        ],
        [
            'another client on the same ALB',
            '10.0.10.0/24',
            '10.0.10.5',
            '198.51.100.2',
            '198.51.100.2',
        ],
        [
            'untrusted peer',
            '10.0.10.0/24',
            '203.0.113.5',
            '198.51.100.1',
            '203.0.113.5',
        ],
        [
            'spoofed prefix before ALB append',
            '10.0.10.0/24',
            '10.0.10.5',
            '192.0.2.99, 198.51.100.1',
            '198.51.100.1',
        ],
        [
            'multiple trusted proxies',
            '10.0.10.0/24, 10.0.20.0/24',
            '10.0.10.5',
            '198.51.100.1, 10.0.20.5',
            '198.51.100.1',
        ],
        [
            'untrusted intermediate proxy',
            '10.0.10.0/24',
            '10.0.10.5',
            '198.51.100.1, 203.0.113.5',
            '203.0.113.5',
        ],
        [
            'hop-count policy',
            1,
            '10.0.10.5',
            '192.0.2.99, 198.51.100.1',
            '198.51.100.1',
        ],
        [
            'explicit trust-all policy',
            true,
            '10.0.10.5',
            '198.51.100.1',
            '198.51.100.1',
        ],
        [
            'no forwarded header',
            '10.0.10.0/24',
            '10.0.10.5',
            undefined,
            '10.0.10.5',
        ],
        [
            'IPv6 client',
            '10.0.10.0/24',
            '10.0.10.5',
            '2001:db8::1',
            '2001:db8::1',
        ],
        [
            'IPv4-mapped peer',
            '10.0.10.0/24',
            '::ffff:10.0.10.5',
            '198.51.100.1',
            '198.51.100.1',
        ],
    ])(
        '%s matches HTTP resolution',
        (_name, trust, peer, forwarded, expected) => {
            const app = express();
            if (trust !== undefined) app.set('trust proxy', trust);
            const socket = new Socket();
            Object.defineProperty(socket, 'remoteAddress', { value: peer });
            const request = new IncomingMessage(socket);
            if (forwarded !== undefined)
                request.headers['x-forwarded-for'] = forwarded;
            const prototype = Object.getPrototypeOf(request);
            expect(getWebsocketClientIp(request, app)).toBe(expected);
            expect(Object.getPrototypeOf(request)).toBe(prototype);
            expect(request.socket).toBe(socket);
            // Express adds its request prototype and app reference for HTTP traffic.
            Object.setPrototypeOf(request, express.request);
            Object.assign(request, { app });
            expect((request as unknown as express.Request).ip).toBe(expected);
            socket.destroy();
        }
    );
});
