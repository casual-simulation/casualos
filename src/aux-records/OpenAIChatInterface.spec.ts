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
import axios from 'axios';
import { OpenAIChatInterface } from './OpenAIChatInterface';

jest.mock('axios', () => ({
    __esModule: true,
    default: { post: jest.fn(), isAxiosError: jest.fn(() => false) },
}));

describe('OpenAIChatInterface sampling compatibility', () => {
    afterEach(() => jest.clearAllMocks());

    it.each([
        ['gpt-6.1-sol', undefined, false],
        ['gpt-6.1-terra', undefined, false],
        ['gpt-6-luna', undefined, false],
        ['gpt-6-astra', undefined, false],
        ['gpt-6-luna', 'none', true],
        ['gpt-4o', undefined, true],
    ])('handles %s with reasoning %s', async (model, effort, sampling) => {
        jest.mocked(axios.post).mockResolvedValue({
            data: {
                choices: [{ message: { role: 'assistant', content: 'Hello' } }],
                usage: { total_tokens: 3 },
            },
        });
        const api = new OpenAIChatInterface({
            apiKey: 'test-key',
            additionalProperties: effort ? { reasoning_effort: effort } : {},
        });
        const result = await api.chat({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            temperature: 1,
            topP: 0.9,
            userId: 'test-user',
        });
        const payload = JSON.parse(
            JSON.stringify(jest.mocked(axios.post).mock.calls[0][1])
        );
        expect(payload.model).toBe(model);
        if (sampling) {
            expect(payload.temperature).toBe(1);
            expect(payload.top_p).toBe(0.9);
        } else {
            expect(payload).not.toHaveProperty('temperature');
            expect(payload).not.toHaveProperty('top_p');
        }
        expect(result.choices[0].content).toBe('Hello');
    });
});
