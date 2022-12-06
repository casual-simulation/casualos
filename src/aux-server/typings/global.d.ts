declare module 'vue-material';
declare module 'vue-shortkey';
declare module 'vue-material/dist/components';
declare module '@chenfengyuan/vue-qrcode';
declare module 'vue-qrcode-reader/src/components/QrcodeStream';
declare module 'vue-filepond';
declare module 'filepond-plugin-file-validate-type';
declare module 'jsbarcode';
declare module 'clipboard-polyfill';
declare module 'rollup-plugin-copy';

declare module 'virtual:pwa-register' {
    export interface RegisterSWOptions {
        immediate?: boolean;
        onNeedRefresh?: () => void;
        onOfflineReady?: () => void;
        onRegistered?: (
            registration: ServiceWorkerRegistration | undefined
        ) => void;
        onRegisterError?: (error: any) => void;
    }

    export function registerSW(
        options?: RegisterSWOptions
    ): (reloadPage?: boolean) => Promise<void>;
}
// declare module 'monaco-editor-core';

declare module '*.jpg' {
    const url: string;
    export default url;
}

declare module '*.png' {
    const url: string;
    export default url;
}

declare module '*.css' {
    const url: string;
    export default url;
}

declare module '*.gltf' {
    const url: string;
    export default url;
}

declare module '*.glb' {
    const url: string;
    export default url;
}

declare module '*.json' {
    const json: any;
    export default json;
}

declare module '*.pem' {
    const content: string;
    export default content;
}

declare module '*.ttf' {
    const url: string;
    export default url;
}

declare module '*.otf' {
    const url: string;
    export default url;
}

declare module '*.woff' {
    const url: string;
    export default url;
}

declare module 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';

declare module 'downloadjs' {
    function download(data: any, fileName: string, mimeType: string): void;
    export default download;
}

declare var PRODUCTION: boolean;
declare var GIT_HASH: string;
declare var GIT_TAG: string;
declare var PROXY_CORS_REQUESTS: boolean;

interface Navigator {
    getUserMedia(
        options: { video?: boolean; audio?: boolean },
        success: (stream: any) => void,
        error?: (error: string) => void
    ): void;
}

interface DeviceMotionEventExtras {
    requestPermission(): Promise<'granted' | 'denied'>;
}

interface FetchEvent extends Event {
    clientId: string;
    request: Request;

    respondWith(response: Response | Promise<Response>): void;
    waitUntil(promise: Promise<any>): void;
}

interface Window {
    addEventListener(name: 'fetch', handler: (event: FetchEvent) => any): void;

    sa_pageview?(pathname: string): void;
}

declare function importScripts(...scripts: string[]): void;
