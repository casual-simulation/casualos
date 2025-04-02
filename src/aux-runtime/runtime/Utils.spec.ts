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
import {
    embedBase64InPdf,
    formatAuthToken,
    fromHexString,
    getEmbeddedBase64FromPdf,
    isPromise,
    parseAuthToken,
    toHexString,
} from './Utils';
import '@casual-simulation/aux-common/BlobPolyfill';

describe('embedBase64InPdf()', () => {
    it('should reference the given data in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const result = embedBase64InPdf(data);

        expect(result).toContain(data);
        expect(result).toMatchSnapshot();
    });
});

describe('getEmbeddedBase64FromPdf()', () => {
    it('should return the data that was embedded in the PDF', () => {
        const data = 'abcdefghiabcdefghi';
        const pdf = embedBase64InPdf(data);
        const result = getEmbeddedBase64FromPdf(pdf);

        expect(result).toEqual(data);
    });
});

describe('formatAuthToken()', () => {
    const cases = [['myToken', 'myService', 'myToken.myService']];

    it.each(cases)('should format %s and %s', (token, service, expected) => {
        const result = formatAuthToken(token, service);

        expect(result).toBe(expected);
    });
});

describe('parseAuthToken()', () => {
    const cases = [
        ['myToken.myService', ['myToken', 'myService']] as const,
        ['myToken.mySer.vice', ['myToken', 'mySer.vice']] as const,
        ['myToken', null as any] as const,
    ] as const;

    it.each(cases)('should format %s and %s', (token, expected) => {
        const result = parseAuthToken(token);

        expect(result).toEqual(expected);
    });
});

describe('fromHexString()', () => {
    const cases: [string, number][] = [
        ['00', 0],
        ['01', 1],
        ['02', 2],
        ['03', 3],
        ['04', 4],
        ['05', 5],
        ['06', 6],
        ['07', 7],
        ['08', 8],
        ['09', 9],
        ['0A', 10],
        ['0B', 11],
        ['0C', 12],
        ['0D', 13],
        ['0E', 14],
        ['0F', 15],

        ['10', 16],
        ['20', 32],
        ['30', 48],
        ['40', 64],
        ['50', 80],
        ['60', 96],
        ['70', 112],
        ['80', 128],
        ['90', 144],
        ['A0', 160],
        ['B0', 176],
        ['C0', 192],
        ['D0', 208],
        ['E0', 224],
        ['F0', 240],
        ['FF', 255],
    ];

    it.each(cases)('should parse %s to %s', (given, expected) => {
        const array = fromHexString(given);
        expect(array).toEqual(new Uint8Array([expected]));
    });

    it('should support long hex strings', () => {
        expect(fromHexString('abcdef1230')).toEqual(
            new Uint8Array([171, 205, 239, 18, 48])
        );
        expect(fromHexString('FFFEFD')).toEqual(
            new Uint8Array([255, 254, 253])
        );
    });
});

describe('toHexString()', () => {
    const cases: [number, string][] = [
        [0, '00'],
        [1, '01'],
        [2, '02'],
        [3, '03'],
        [4, '04'],
        [5, '05'],
        [6, '06'],
        [7, '07'],
        [8, '08'],
        [9, '09'],
        [10, '0a'],
        [11, '0b'],
        [12, '0c'],
        [13, '0d'],
        [14, '0e'],
        [15, '0f'],

        [16, '10'],
        [32, '20'],
        [48, '30'],
        [64, '40'],
        [80, '50'],
        [96, '60'],
        [112, '70'],
        [128, '80'],
        [144, '90'],
        [160, 'a0'],
        [176, 'b0'],
        [192, 'c0'],
        [208, 'd0'],
        [224, 'e0'],
        [240, 'f0'],
        [255, 'ff'],
    ];

    it.each(cases)('should transform %d to %s', (given, expected) => {
        const str = toHexString(new Uint8Array([given]));
        expect(str).toBe(expected);
    });

    it('should support long hex strings', () => {
        expect(toHexString(new Uint8Array([171, 205, 239, 18, 48]))).toBe(
            'abcdef1230'
        );
        expect(toHexString(new Uint8Array([255, 254, 253]))).toBe('fffefd');
    });
});

describe('isPromise()', () => {
    it('should return true if the value is a promise', () => {
        let p = new Promise((resolve, reject) => {});
        expect(isPromise(p)).toBe(true);
    });

    it('should return false if the value is not a promise', () => {
        expect(isPromise({})).toBe(false);
        expect(
            isPromise({
                then: () => {},
                catch: () => {},
            })
        ).toBe(false);
        expect(isPromise(null)).toBe(false);
        expect(isPromise(undefined)).toBe(false);
        expect(isPromise(123)).toBe(false);
        expect(isPromise('abc')).toBe(false);
        expect(isPromise(true)).toBe(false);
    });
});
