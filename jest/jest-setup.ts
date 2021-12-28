import '@testing-library/jest-dom';

/**
 * Defines a matcher that makes it possible to use any Jest expect method inside a assertion that supports
 * matchers.
 * See https://stackoverflow.com/a/47160877/1832856
 */
class SatisfiesMatcher {
    matcher: keyof jest.MatcherMethods;
    matcherArgs: any[];

    constructor(matcher: keyof jest.MatcherMethods, ...matcherArgs: any[]) {
        this.matcher = matcher;
        this.matcherArgs = matcherArgs;
    }

    asymmetricMatch(other: any) {
        let result = expect(other)[this.matcher];
        if (typeof result === 'function') {
            (result as (...args: any[]) => void)(...this.matcherArgs);
        } else {
            throw new Error(
                'Unable to perform match on ' +
                    this.matcher.toString() +
                    '. It is not a function.'
            );
        }
        return true;
    }
}

(expect as any).expect = (matcher: keyof jest.MatcherMethods, ...args: any) =>
    new SatisfiesMatcher(matcher, ...args);
