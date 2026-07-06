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
import { lookup as dnsLookup } from 'node:dns/promises';
import {
    LinkPreviewController,
    extractLinkPreviewData,
    getCacheKey,
    isPrivateOrReservedAddress,
    normalizeUrl,
} from './LinkPreviewController';
import { MemoryLinkPreviewStore } from './MemoryLinkPreviewStore';
import { MemoryRateLimiter } from './MemoryRateLimiter';

jest.mock('axios');
jest.mock('node:dns/promises');

console.log = jest.fn();
console.error = jest.fn();

const mockAxios = require('axios');
const mockedDnsLookup = dnsLookup as jest.MockedFunction<typeof dnsLookup>;

describe('LinkPreviewController', () => {
    let store: MemoryLinkPreviewStore;
    let rateLimiter: MemoryRateLimiter;
    let subject: LinkPreviewController;

    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        store = new MemoryLinkPreviewStore();
        rateLimiter = new MemoryRateLimiter();
        subject = new LinkPreviewController({
            store,
            rateLimiter,
            config: {
                rateLimit: {
                    maxHits: 2,
                    windowMs: 60_000,
                },
                minCacheSeconds: 1800,
                requestTimeoutMs: 10_000,
                maxResponseBytes: 5_000_000,
            },
        });

        mockAxios.__reset();
        mockedDnsLookup.mockReset();
        mockedDnsLookup.mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
        ] as any);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function mockHtmlResponse(
        html: string,
        headers: { [key: string]: string } = {}
    ) {
        mockAxios.__setResponse({
            data: html,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                ...headers,
            },
            request: {
                res: {
                    responseUrl: 'https://example.com/page',
                },
            },
        });
    }

    describe('getLinkPreview()', () => {
        it('should reject non-http(s) URLs', async () => {
            const result = await subject.getLinkPreview({
                url: 'ftp://example.com/file',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The given URL is not able to be previewed.',
            });
            expect(mockAxios.__getRequests()).toEqual([]);
        });

        it('should reject URLs that point to private IP addresses', async () => {
            const result = await subject.getLinkPreview({
                url: 'http://127.0.0.1/admin',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The given URL is not able to be previewed.',
            });
            expect(mockAxios.__getRequests()).toEqual([]);
            expect(mockedDnsLookup).not.toHaveBeenCalled();
        });

        it('should reject URLs whose hostname resolves to a private IP address', async () => {
            mockedDnsLookup.mockResolvedValue([
                { address: '10.0.0.5', family: 4 },
            ] as any);

            const result = await subject.getLinkPreview({
                url: 'https://internal.example.com/',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The given URL is not able to be previewed.',
            });
            expect(mockAxios.__getRequests()).toEqual([]);
        });

        it('should fetch and parse the link preview for a URL', async () => {
            mockHtmlResponse(`
                <html>
                    <head>
                        <title>Fallback Title</title>
                        <meta name="description" content="Fallback description" />
                        <meta property="og:title" content="Example Title" />
                        <meta property="og:description" content="Example description" />
                        <meta property="og:image" content="/images/preview.png" />
                        <meta property="og:image:width" content="1200" />
                        <meta property="og:image:height" content="630" />
                        <meta property="og:image:alt" content="A preview image" />
                        <meta property="og:type" content="website" />
                        <meta property="og:site_name" content="Example Site" />
                        <meta property="og:locale" content="en_US" />
                        <link rel="canonical" href="https://example.com/canonical-page" />
                    </head>
                    <body></body>
                </html>
            `);

            const result = await subject.getLinkPreview({
                url: 'https://example.com/page',
            });

            expect(result).toEqual({
                success: true,
                title: 'Example Title',
                description: 'Example description',
                imageUrl: 'https://example.com/images/preview.png',
                imageWidth: 1200,
                imageHeight: 630,
                imageAlt: 'A preview image',
                type: 'website',
                canonicalUrl: 'https://example.com/canonical-page',
                siteName: 'Example Site',
                locale: 'en_US',
                cachedUntilMs: 1800 * 1000,
                meta: expect.objectContaining({
                    'og:title': 'Example Title',
                    description: 'Fallback description',
                }),
            });
        });

        it('should fall back to the title tag and meta description when OG tags are missing', async () => {
            mockHtmlResponse(`
                <html>
                    <head>
                        <title>Fallback Title</title>
                        <meta name="description" content="Fallback description" />
                        <link rel="icon" href="/favicon.ico" />
                    </head>
                </html>
            `);

            const result = await subject.getLinkPreview({
                url: 'https://example.com/page',
            });

            expect(result).toMatchObject({
                success: true,
                title: 'Fallback Title',
                description: 'Fallback description',
                imageUrl: 'https://example.com/favicon.ico',
            });
        });

        it('should return url_not_html if the response is not HTML', async () => {
            mockAxios.__setResponse({
                data: '{}',
                headers: { 'content-type': 'application/json' },
                request: { res: { responseUrl: 'https://example.com/data' } },
            });

            const result = await subject.getLinkPreview({
                url: 'https://example.com/data',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'url_not_html',
                errorMessage: 'The given URL does not point to an HTML page.',
            });
        });

        it('should cache successful results and not fetch again while the cache is valid', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>');

            const first = await subject.getLinkPreview({
                url: 'https://example.com/page?b=2&a=1',
            });
            expect(first.success).toBe(true);
            expect(mockAxios.__getRequests().length).toBe(1);

            const second = await subject.getLinkPreview({
                url: 'https://example.com/page?a=1&b=2#fragment',
            });

            expect(second).toEqual(first);
            expect(mockAxios.__getRequests().length).toBe(1);
        });

        it('should extend the cache time using the Cache-Control max-age header', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>', {
                'cache-control': 'public, max-age=7200',
            });

            const result = await subject.getLinkPreview({
                url: 'https://example.com/page',
            });

            expect(result).toMatchObject({
                success: true,
                cachedUntilMs: 7200 * 1000,
            });
        });

        it('should use the minimum cache time if the Cache-Control max-age is shorter', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>', {
                'cache-control': 'public, max-age=60',
            });

            const result = await subject.getLinkPreview({
                url: 'https://example.com/page',
            });

            expect(result).toMatchObject({
                success: true,
                cachedUntilMs: 1800 * 1000,
            });
        });

        it('should rate limit requests per-origin', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>');

            const r1 = await subject.getLinkPreview({
                url: 'https://example.com/page-1',
            });
            const r2 = await subject.getLinkPreview({
                url: 'https://example.com/page-2',
            });
            const r3 = await subject.getLinkPreview({
                url: 'https://example.com/page-3',
            });

            expect(r1.success).toBe(true);
            expect(r2.success).toBe(true);
            expect(r3).toEqual({
                success: false,
                errorCode: 'site_rate_limited',
                errorMessage:
                    'Too many requests have been made for this site. Please try again later.',
            });
        });

        it('should not rate limit requests to different origins', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>');

            await subject.getLinkPreview({ url: 'https://example.com/a' });
            await subject.getLinkPreview({ url: 'https://example.com/b' });
            const result = await subject.getLinkPreview({
                url: 'https://other.example.org/a',
            });

            expect(result.success).toBe(true);
        });

        it('should return a server_error if the request fails', async () => {
            mockAxios.__setFail(true);

            const result = await subject.getLinkPreview({
                url: 'https://example.com/page',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });
        });

        it('should send the given locale as the Accept-Language header', async () => {
            mockHtmlResponse('<html><head><title>Title</title></head></html>');

            await subject.getLinkPreview({
                url: 'https://example.com/page',
                locale: 'fr-FR',
            });

            expect(mockAxios.__getLastGet()).toEqual([
                'https://example.com/page',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Accept-Language': 'fr-FR',
                    }),
                }),
            ]);
        });
    });

    describe('normalizeUrl()', () => {
        it('should strip the hash', () => {
            expect(
                normalizeUrl(new URL('https://example.com/page#section'))
            ).toBe('https://example.com/page');
        });

        it('should sort query parameters alphabetically', () => {
            expect(
                normalizeUrl(new URL('https://example.com/page?b=2&a=1&c=3'))
            ).toBe('https://example.com/page?a=1&b=2&c=3');
        });
    });

    describe('getCacheKey()', () => {
        it('should produce different keys for different locales', () => {
            const a = getCacheKey('https://example.com/page', 'en');
            const b = getCacheKey('https://example.com/page', 'fr');
            expect(a).not.toEqual(b);
        });

        it('should produce the same key for the same URL and locale', () => {
            const a = getCacheKey('https://example.com/page', 'en');
            const b = getCacheKey('https://example.com/page', 'en');
            expect(a).toEqual(b);
        });
    });

    describe('extractLinkPreviewData()', () => {
        it('should collect all meta tags', () => {
            const data = extractLinkPreviewData(
                `<html><head>
                    <meta property="og:title" content="Title" />
                    <meta name="twitter:card" content="summary" />
                </head></html>`,
                'https://example.com/'
            );

            expect(data.meta).toEqual({
                'og:title': 'Title',
                'twitter:card': 'summary',
            });
        });
    });

    describe('isPrivateOrReservedAddress()', () => {
        it.each([
            ['127.0.0.1', true],
            ['10.1.2.3', true],
            ['172.16.0.1', true],
            ['172.31.255.255', true],
            ['172.32.0.1', false],
            ['192.168.1.1', true],
            ['169.254.1.1', true],
            ['0.0.0.0', true],
            ['8.8.8.8', false],
            ['93.184.216.34', false],
            ['::1', true],
            ['fe80::1', true],
            ['fc00::1', true],
            ['2001:4860:4860::8888', false],
        ])('should classify %s as private=%s', (ip, expected) => {
            expect(isPrivateOrReservedAddress(ip)).toBe(expected);
        });
    });
});
