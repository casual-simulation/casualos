declare module '*?worker' {
    class ViteWorker extends Worker {
        constructor();
    }

    export default ViteWorker;
}

declare module '*?worker&inline' {
    class ViteWorker extends Worker {
        constructor();
    }

    export default ViteWorker;
}
