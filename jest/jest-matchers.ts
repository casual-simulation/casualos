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

expect.extend({
    toBeUtf8EncodedText: (recieved: ArrayBuffer, expected: string) => {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(expected);
        expect(recieved).toEqual(encoded);

        return {
            pass: true,
            message: () => `Expected UTF-8 encoded text to be ${expected}`,
        };
    },
});

(expect as any).expect = (matcher: keyof jest.MatcherMethods, ...args: any) =>
    new SatisfiesMatcher(matcher, ...args);

// See https://stackoverflow.com/a/63990350/1832856
type Methods<T> = { [P in keyof T as T[P] extends Function ? P : never]: T[P] };

declare namespace jest {
    interface Matchers<R, T = {}> {
        toBeUtf8EncodedText: (expected: string) => void;
    }

    type MatcherMethods = Methods<JestMatchers<any>>;

    interface Expect {
        expect<T extends keyof MatcherMethods>(
            matcher: T,
            ...args: Parameters<MatcherMethods[T]>
        ): ReturnType<MatcherMethods[T]>;
    }
}
