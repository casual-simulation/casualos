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
    } else if (message.data.type === 'load_text') {
        const id = message.data.id;
        const source = message.data.text;

        let paragraph: HTMLElement;
        const existingText = document.getElementById(`script-${id}`);
        if (existingText) {
            paragraph = existingText;
        } else {
            paragraph = document.createElement(message.data.element || 'p');
            paragraph.setAttribute('id', `text-${id}`);
        }

        paragraph.textContent = source;
        document.body.append(paragraph);
        (<any>message.source).postMessage(
            {
                type: 'text_loaded',
                id,
            },
            message.origin
        );
    } else if (message.data.type === 'reload') {
        location.reload();
    } else if (message.data.type === 'inject_port') {
        const id = message.data.id;
        const port = message.data.port;
        const global = globalThis as any;
        if (!global.__injectedPorts) {
            global.__injectedPorts = {};
        }

        global.__injectedPorts[id] = port;
        (<any>message.source).postMessage(
            {
                type: 'port_injected',
                id,
            },
            message.origin
        );
    }
});
