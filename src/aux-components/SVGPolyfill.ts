import '@casual-simulation/aux-vm/globalThis-polyfill';
if (!globalThis.SVGElement) {
    console.warn(
        "[SVGPolyfill] Polyfilling SVGElement since browser doesn't implement it."
    );
    class SVGElementImpl extends Element {}
    globalThis.SVGElement = <any>SVGElementImpl;
}
