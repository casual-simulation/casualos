/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable jest/no-focused-tests */

export function isJestJasmineRun(): boolean {
    return process.env.JEST_JASMINE === '1';
}

export function skipSuiteOnJasmine(): void {
    if (isJestJasmineRun()) {
        test.only('does not work on Jasmine', () => {
            console.warn('[SKIP] Does not work on Jasmine');
        });
    }
}

export function skipSuiteOnJestCircus(): void {
    if (!isJestJasmineRun()) {
        test.only('does not work on jest-circus', () => {
            console.warn('[SKIP] Does not work on jest-circus');
        });
    }
}
