import {
    parseCacheControlHeader,
    CacheControlHeaderValues,
    formatCacheControlHeader,
} from './CacheHelpers';

describe('CacheHelpers', () => {
    describe('parseCacheControlHeader()', () => {
        const cases: [string, CacheControlHeaderValues][] = [
            ['public', { public: true }],
            ['private', { private: true }],
            ['max-age=10', { 'max-age': 10 }],
            ['public, max-age=10', { public: true, 'max-age': 10 }],
            ['s-maxage=10', { 's-maxage': 10 }],
            ['no-cache', { 'no-cache': true }],
            ['no-store', { 'no-store': true }],
        ];

        it.each(cases)('should parse %s', (header, expected) => {
            const result = parseCacheControlHeader(header);

            expect(result).toEqual(expected);
        });
    });

    describe('formatCacheControlHeader()', () => {
        const cases: [string, CacheControlHeaderValues][] = [
            ['public', { public: true }],
            ['private', { private: true }],
            ['max-age=10', { 'max-age': 10 }],
            ['public, max-age=10', { public: true, 'max-age': 10 }],
            ['s-maxage=10', { 's-maxage': 10 }],
            ['no-cache', { 'no-cache': true }],
            ['no-store', { 'no-store': true }],
            ['', {}],
        ];

        it.each(cases)('should format %s', (expected, data) => {
            const result = formatCacheControlHeader(data);

            expect(result).toBe(expected);
        });
    });
});
