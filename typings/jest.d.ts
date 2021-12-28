// See https://stackoverflow.com/a/63990350/1832856
type Methods<T> = { [P in keyof T as T[P] extends Function ? P : never]: T[P] };

declare namespace jest {
    type MatcherMethods = Methods<JestMatchers<any>>;

    interface Expect {
        expect: (matcher: keyof MatcherMethods, ...args: any) => any;
    }
}
