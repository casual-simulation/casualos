import '@casual-simulation/aux-vm/globalThis-polyfill';
import { Message } from 'comlink/dist/umd/protocol';
import { Observable } from 'rxjs';

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
 * @param origin The origin that the channels should be recieved from.
 */
export function listenForChannels(origin?: string): Observable<MessagePort> {
    return new Observable((observer) => {
        let listener = (msg: MessageEvent) => {
            if (msg.data.type === 'init_port') {
                if (!origin || msg.origin === origin) {
                    observer.next(msg.data.port);
                }
            }
        };
        globalThis.addEventListener('message', listener);

        return () => {
            globalThis.removeEventListener('message', listener);
        };
    });
}

/**
 * Listens for the init_port event from the global context.
 * @param origin The origin that the channel should be recieved from.
 */
export function listenForChannel(origin?: string): Promise<MessagePort> {
    return new Promise<MessagePort>((resolve) => {
        let listener = (msg: MessageEvent) => {
            if (msg.data.type === 'init_port') {
                if (!origin || msg.origin === origin) {
                    globalThis.removeEventListener('message', listener);
                    resolve(msg.data.port);
                }
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

/**
 * Injects the given message port with the given ID into the iframe.
 * @param iframeWindow The iframe that the message port should be injected into.
 * @param id The ID of the message port.
 * @param port The port to inject.
 */
export function injectPort(
    iframeWindow: Window,
    id: string,
    port: MessagePort
) {
    return new Promise<void>((resolve, reject) => {
        const listener = (message: MessageEvent) => {
            if (message.source !== iframeWindow) {
                return;
            }
            if (
                message.data.type === 'port_injected' &&
                message.data.id === id
            ) {
                globalThis.removeEventListener('message', listener);
                resolve();
            }
        };
        globalThis.addEventListener('message', listener);
        iframeWindow.postMessage(
            {
                type: 'inject_port',
                id,
                port,
            },
            '*',
            [port]
        );
    });
}

/**
 * Loads the script at the given URL into the given iframe window.
 * @param iframeWindow The iframe.
 * @param id The ID of the script.
 * @param text The text to load.
 * @param element The HTML element the text should be loaded in.
 */
export function loadText(
    iframeWindow: Window,
    id: string,
    text: string,
    element: string
) {
    return new Promise<void>((resolve, reject) => {
        const listener = (message: MessageEvent) => {
            if (message.source !== iframeWindow) {
                return;
            }
            if (message.data.type === 'text_loaded' && message.data.id === id) {
                globalThis.removeEventListener('message', listener);
                resolve();
            }
        };
        globalThis.addEventListener('message', listener);
        iframeWindow.postMessage(
            {
                type: 'load_text',
                id,
                text,
                element,
            },
            '*'
        );
    });
}

/**
 * Reloads the iframe.
 * @param iframeWindow The iframe to reload.
 */
export function reload(iframeWindow: HTMLIFrameElement) {
    const promise = waitForLoad(iframeWindow);

    iframeWindow.contentWindow.postMessage(
        {
            type: 'reload',
        },
        '*'
    );

    return promise;
}

/**
 * Creates
 * @param options
 * @param properties
 */
export async function setupCustomIframe(
    options: { vmOrigin: string },
    properties?: Partial<HTMLIFrameElement>
) {
    const origin = options.vmOrigin || location.origin;
    const iframeUrl = new URL('/aux-vm-iframe.html', origin).href;

    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.style.display = 'none';

    if (properties) {
        for (let key in properties) {
            (<any>iframe)[key] = (<any>properties)[key];
        }
    }

    // Allow the iframe to run scripts, but do nothing else.
    // Because we're not allowing the same origin, this prevents the VM from talking to
    // storage like IndexedDB and therefore prevents different VMs from affecting each other.
    // iframe.sandbox.add('allow-scripts');

    // const bowserResult = Bowser.parse(navigator.userAgent);

    // Safari requires the allow-same-origin option in order to load
    // web workers using a blob.
    // if (
    //     bowserResult.browser.name === 'Safari' ||
    //     bowserResult.os.name === 'iOS'
    // ) {
    //     console.warn('[AuxVMImpl] Adding allow-same-origin for Safari');
    //     iframe.sandbox.add('allow-same-origin');
    // }

    let promise = waitForLoad(iframe);
    document.body.insertBefore(iframe, document.body.firstChild);

    await promise;

    return iframe;
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
