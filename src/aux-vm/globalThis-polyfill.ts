/**
 * globatThis polyfill, dont touch.
 * Ref: https://mathiasbynens.be/notes/globalthis
 * Used to get oculus browser running.
 */
declare var __magic__: any;
(function () {
    console.log('[globalThis-polyfill] load');
    if (typeof globalThis === 'object') return;
    (<any>Object.prototype).__defineGetter__('__magic__', function () {
        return this;
    });
    __magic__.globalThis = __magic__; // lolwat
    delete (<any>Object.prototype).__magic__;
    // Your code can use `globalThis` now.
})();

(globalThis as any).global = globalThis;
