declare module 'worker-loader!*' {
    class WebpackWorker extends Worker {
        constructor();
    }

    export default WebpackWorker;
}

declare module '!worker-loader!*' {
    class WebpackWorker extends Worker {
        constructor();
    }

    export default WebpackWorker;
}

declare module '*.worker' {
    class WebpackWorker extends Worker {
        constructor();
    }

    export default WebpackWorker;
}

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
