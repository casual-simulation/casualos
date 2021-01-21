import '@casual-simulation/aux-vm/globalThis-polyfill';

globalThis.addEventListener('message', (message) => {
    if (message.data.type === 'load_script') {
        const id = message.data.id;
        const source = message.data.source;

        let script: HTMLScriptElement;
        const existingScript = document.getElementById(`script-${id}`);
        if (existingScript && existingScript instanceof HTMLScriptElement) {
            script = existingScript;
        } else {
            script = document.createElement('script');
            script.setAttribute('id', `script-${id}`);
        }

        script.textContent = source;
        document.body.append(script);
        (<any>message.source).postMessage(
            {
                type: 'script_loaded',
                id,
            },
            message.origin
        );
    } else if (message.data.type === 'reload') {
        location.reload();
    }
});
