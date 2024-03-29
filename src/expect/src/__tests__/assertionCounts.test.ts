/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { alignedAnsiStyleSerializer } from '../test-utils';
import jestExpect from '../';
import chalk from '@casual-simulation/chalk';

expect.addSnapshotSerializer(alignedAnsiStyleSerializer as any);

beforeAll(() => {
    chalk.level = 1;
});

afterAll(() => {
    chalk.level = 0;
});

describe('.assertions()', () => {
    it('does not throw', () => {
        jestExpect.assertions(2);
        jestExpect('a').not.toBe('b');
        jestExpect('a').toBe('a');
    });

    it('redeclares different assertion count', () => {
        jestExpect.assertions(3);
        jestExpect('a').not.toBe('b');
        jestExpect('a').toBe('a');
        jestExpect.assertions(2);
    });
    it('expects no assertions', () => {
        jestExpect.assertions(0);
    });
});

describe('.hasAssertions()', () => {
    it('does not throw if there is an assertion', () => {
        jestExpect.hasAssertions();
        jestExpect('a').toBe('a');
    });

    it('throws if expected is not undefined', () => {
        expect(() => {
            // @ts-expect-error
            jestExpect.hasAssertions(2);
        }).toThrowErrorMatchingSnapshot();
    });

    it('hasAssertions not leaking to global state', () => {});
});
