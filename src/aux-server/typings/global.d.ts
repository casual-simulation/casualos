declare module 'vue-material';
declare module 'vue-shortkey';
declare module 'vue-material/dist/components';
declare module '@chenfengyuan/vue-qrcode';
declare module 'vue-qrcode-reader/src/components/QrcodeStream';
declare module 'vue-filepond';
declare module 'filepond-plugin-file-validate-type';
declare module 'jsbarcode';
declare module 'quagga';
declare module 'clipboard-polyfill';
declare module 'rollup-plugin-copy';

declare module '*.jpg' {
    const url: string;
    export default url;
}

declare module '*.png' {
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
