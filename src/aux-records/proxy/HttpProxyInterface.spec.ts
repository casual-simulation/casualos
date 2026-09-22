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
import { HttpProxyInterface } from './HttpProxyInterface';
import type { ProxyInterfaceRequest } from './ProxyInterface';

describe('HttpProxyInterface', () => {
    let subject: HttpProxyInterface;

    beforeEach(() => {
        subject = new HttpProxyInterface();
    });

    function request(host: string): ProxyInterfaceRequest {
        return {
            host,
            path: '/',
            method: 'GET',
            headers: {},
            body: null,
        };
    }

    it('should reject hosts that are not valid', async () => {
        const result = await subject.sendRequest(
            request('https://example.com/path')
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('invalid_proxy_host');
    });

    const privateHosts = [
        ['127.0.0.1'],
        ['127.0.0.1:8443'],
        ['10.0.0.1'],
        ['172.16.5.4'],
        ['192.168.1.1'],
        ['169.254.169.254'],
        ['[::1]'],
        ['[fe80::1]:8443'],
        ['localhost'],
        ['localhost:8443'],
    ];

    it.each(privateHosts)(
        'should reject %s because it is not publicly routable',
        async (host) => {
            const result = await subject.sendRequest(request(host));

            expect(result.success).toBe(false);
            expect((result as any).error.errorCode).toBe('invalid_proxy_host');
        }
    );

    it('should reject hosts that cannot be resolved', async () => {
        const result = await subject.sendRequest(
            request('this-host-does-not-exist.invalid')
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('invalid_proxy_host');
    });

    it('should return a failure instead of throwing when the request options are invalid', async () => {
        const permissive = new HttpProxyInterface({
            allowPrivateIpAddresses: true,
        });

        const result = await permissive.sendRequest({
            ...request('127.0.0.1:1'),
            headers: {
                authorization: 'Bearer bad\r\nX-Injected: true',
            },
        });

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('proxy_request_failed');
    });

    it('should allow private addresses when they are explicitly allowed', async () => {
        const permissive = new HttpProxyInterface({
            allowPrivateIpAddresses: true,
        });

        // Nothing is listening on this port, so the request should fail to connect
        // instead of being rejected because the address is private.
        const result = await permissive.sendRequest(request('127.0.0.1:1'));

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('proxy_request_failed');
    });
});
