import '@casual-simulation/aux-vm/globalThis-polyfill';

globalThis.addEventListener('message', (message) => {
    if (message.data.type === 'load_script') {
        const url = message.data.url;

        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            (<any>message.source).postMessage(
                {
                    type: 'script_loaded',
                    url,
                },
                message.origin
            );
        };
        document.body.append(script);
    }
});
