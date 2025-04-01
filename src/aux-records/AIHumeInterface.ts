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
import type { ServerError } from '@casual-simulation/aux-common';
import { z } from 'zod';

/**
 * Defines an interface that is able to be used to provide [hume.ai](https://www.hume.ai/) features for a server.
 */
export interface AIHumeInterface {
    /**
     * Generates an access token that can be used to access the Hume API.
     * @param request The request that contains the API key and secret key.
     */
    getAccessToken(
        request: AIHumeInterfaceGetAccessTokenRequest
    ): Promise<AIHumeInterfaceGetAccessTokenResult>;
}

export class HumeInterface implements AIHumeInterface {
    constructor() {}

    async getAccessToken(
        request: AIHumeInterfaceGetAccessTokenRequest
    ): Promise<AIHumeInterfaceGetAccessTokenResult> {
        const authString = `${request.apiKey}:${request.secretKey}`;
        const encodedAuthString = Buffer.from(authString).toString('base64');

        const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${encodedAuthString}`,
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
            }).toString(),
            cache: 'no-cache',
        });

        if (!response.ok) {
            const data = await response.text();
            console.error(
                `[HumeInterface] Failed to get access token from Hume. Status: ${response.status} Data:`,
                data
            );
            return {
                success: false,
                errorCode: 'hume_api_error',
                errorMessage: `Failed to get access token from Hume.`,
            };
        }

        const data = await response.json();
        const schema = z.object({
            access_token: z.string(),
            expires_in: z.number(),
            issued_at: z.number(),
            token_type: z.literal('Bearer'),
        });

        const result = schema.safeParse(data);

        if (!result.success) {
            console.error(
                `[HumeInterface] Failed to parse access token data from Hume. Data:`,
                data
            );
            return {
                success: false,
                errorCode: 'hume_api_error',
                errorMessage: `Failed to parse access token data from Hume.`,
            };
        }

        return {
            success: true,
            accessToken: result.data.access_token,
            expiresIn: result.data.expires_in,
            issuedAt: result.data.issued_at,
            tokenType: result.data.token_type,
        };
    }
}

export interface AIHumeInterfaceGetAccessTokenRequest {
    /**
     * The API key that should be used for the request.
     */
    apiKey: string;
    secretKey: string;
}

export type AIHumeInterfaceGetAccessTokenResult =
    | AIHumeInterfaceGetAccessTokenSuccess
    | AIHumeInterfaceGetAccessTokenFailure;

export interface AIHumeInterfaceGetAccessTokenSuccess {
    success: true;
    /**
     * The access token that was generated.
     */
    accessToken: string;

    /**
     * The number of seconds that the token expires in.
     */
    expiresIn: number;

    /**
     * The unix time in seconds that the token was issued at.
     */
    issuedAt: number;

    /**
     * The type of token that was generated.
     */
    tokenType: 'Bearer';
}

export interface AIHumeInterfaceGetAccessTokenFailure {
    success: false;
    errorCode: ServerError | 'hume_api_error';
    errorMessage: string;
}
