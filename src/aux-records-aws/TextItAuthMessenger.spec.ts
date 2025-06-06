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
import { TextItAuthMessenger } from './TextItAuthMessenger';

jest.mock('axios');

describe('TextItAuthMessenger', () => {
    let messenger: TextItAuthMessenger;

    beforeEach(() => {
        require('axios').__reset();
        messenger = new TextItAuthMessenger('api_key', 'flow_id');
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('supportsAddressType()', () => {
        it('should return true for email', async () => {
            expect(await messenger.supportsAddressType('email')).toBe(true);
        });

        it('should return true for phone', async () => {
            expect(await messenger.supportsAddressType('phone')).toBe(true);
        });

        it('should return false for other', async () => {
            expect(await messenger.supportsAddressType('other' as any)).toBe(
                false
            );
        });
    });

    describe('sendCode()', () => {
        it('should send a TextIt flow start for the given email', async () => {
            setResponse({
                data: {},
            });
            const result = await messenger.sendCode(
                'myemail@example.com',
                'email',
                'mycode'
            );

            expect(result).toEqual({
                success: true,
            });

            expect(getLastPost()).toEqual([
                'https://textit.com/api/v2/flow_starts.json',
                {
                    flow: 'flow_id',
                    urns: ['mailto:myemail@example.com'],
                    params: {
                        code: 'mycode',
                    },
                    restart_participants: true,
                },
                {
                    headers: {
                        Authorization: 'Token api_key',
                    },
                },
            ]);
        });

        it('should send a TextIt flow start for the given phone number', async () => {
            setResponse({
                data: {},
            });
            const result = await messenger.sendCode(
                '+15555555555',
                'phone',
                'mycode'
            );

            expect(result).toEqual({
                success: true,
            });

            expect(getLastPost()).toEqual([
                'https://textit.com/api/v2/flow_starts.json',
                {
                    flow: 'flow_id',
                    urns: ['tel:+15555555555'],
                    params: {
                        code: 'mycode',
                    },
                    restart_participants: true,
                },
                {
                    headers: {
                        Authorization: 'Token api_key',
                    },
                },
            ]);
        });

        it('should return an address type not supported result if given a non phone or email address type', async () => {
            setResponse({
                data: {},
            });
            const result = await messenger.sendCode(
                'other address',
                'other' as any,
                'mycode'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'address_type_not_supported',
                errorMessage: expect.any(String),
            });

            expect(getLastPost()).toBeUndefined();
        });

        it('should return a unacceptable_address result if the server returns a 400 status code', async () => {
            setResponse({
                error: true,
                status: 400,
                data: {},
            });
            const result = await messenger.sendCode(
                '+15555555555',
                'phone',
                'mycode'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage: expect.any(String),
            });

            expect(getLastPost()).toEqual([
                'https://textit.com/api/v2/flow_starts.json',
                {
                    flow: 'flow_id',
                    urns: ['tel:+15555555555'],
                    params: {
                        code: 'mycode',
                    },
                    restart_participants: true,
                },
                {
                    headers: {
                        Authorization: 'Token api_key',
                    },
                },
            ]);
        });
    });
});
