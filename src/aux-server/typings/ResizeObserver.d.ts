import Polyfill from '@juggle/resize-observer';

declare global {
    interface Window {
        ResizeObserver: typeof Polyfill;
    }
}
