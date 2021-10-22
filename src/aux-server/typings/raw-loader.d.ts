declare module 'raw-loader!*' {
    const content: string;
    export default content;
}

declare module '!raw-loader!*' {
    const content: string;
    export default content;
}

declare module '*?raw' {
    const content: string;
    export default content;
}
