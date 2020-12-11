import '@casual-simulation/aux-vm/globalThis-polyfill';

/**
 * Creates a new message channel and sends port2 to the iframe in a message.
 * @param iframeWindow The window to send the port to.
 */
export function setupChannel(iframeWindow: Window) {
    const channel = new MessageChannel();

    iframeWindow.postMessage(
        {
            type: 'init_port',
            port: channel.port2,
        },
        '*',
        [channel.port2]
    );

    return channel;
}

/**
 * Listens for the init_port event from the global context.
 */
export function listenForChannel(): Promise<MessagePort> {
    return new Promise<MessagePort>((resolve) => {
        let listener = (msg: MessageEvent) => {
            if (msg.data.type === 'init_port') {
                globalThis.removeEventListener('message', listener);
                resolve(msg.data.port);
            }
        };
        globalThis.addEventListener('message', listener);
    });
}

export function waitForLoad(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise<void>((resolve) => {
        let listener = () => {
            iframe.removeEventListener('load', listener);
            resolve();
        };
        iframe.addEventListener('load', listener);
    });
}

/**
 * Loads the script at the given URL into the given iframe window.
 * @param iframeWindow The iframe.
 * @param id The ID of the script.
 * @param source The source code to load.
 */
export function loadScript(iframeWindow: Window, id: string, source: string) {
    return new Promise<void>((resolve, reject) => {
        const listener = (message: MessageEvent) => {
            if (message.source !== iframeWindow) {
                debugger;
                return;
            }
            if (
                message.data.type === 'script_loaded' &&
                message.data.id === id
            ) {
                globalThis.removeEventListener('message', listener);
                resolve();
            }
        };
        globalThis.addEventListener('message', listener);
        iframeWindow.postMessage(
            {
                type: 'load_script',
                id,
                source,
            },
            '*'
        );
    });
}

// /**
//  * Loads the script into the iframe window as a portal.
//  * @param iframeWindow The iframe.
//  * @param id The ID of the portal.
//  * @param source The source code to load.
//  */
// export function registerIFramePortal(iframeWindow: Window, id: string, source: string) {
//     return new Promise<void>((resolve, reject) => {
//         const listener = (message: MessageEvent) => {
//             if (message.source !== iframeWindow) {
//                 debugger;
//                 return;
//             }
//             if (
//                 message.data.type === 'portal_registered' &&
//                 message.data.id === id
//             ) {
//                 globalThis.removeEventListener('message', listener);
//                 resolve();
//             }
//         };
//         globalThis.addEventListener('message', listener);
//         iframeWindow.postMessage(
//             {
//                 type: 'register_portal',
//                 id,
//                 source
//             },
//             '*'
//         );
//     });
// }
