declare module 'vue-material';
declare module 'vue-material/dist/components';

declare module '*.svg' {
  const icon: Vue;
  export default icon;
}

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

declare module 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';

declare module 'formula-lib' {
  const lib: string;
  export default lib; 
}

declare var PRODUCTION: boolean;
declare var SENTRY_DSN: string;
declare var ENABLE_SENTRY: boolean;
declare var GIT_HASH: string;


interface SymbolConstructor {
  (): symbol;
  (name: string): symbol;
  (id: number): symbol;
}