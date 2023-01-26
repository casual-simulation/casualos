import type Vue from 'vue';
import type { VNode } from 'vue';
import type { DirectiveBinding } from 'vue/types/options';

interface MapFunctions {
    [key: string]: BoundKey;
}

interface BoundKey {
    value: string[];
    vnodes: VNode[];
    once: boolean;
    push: boolean;
    focus: boolean;
    prevent: boolean;
    stop: boolean;
}

interface BindingOutputs {
    value: string[];
    push: boolean;
    once: boolean;
    focus: boolean;
    prevent: boolean;
    stop: boolean;
    vnode: VNode;
}

interface InstallOptions {
    ignore?: string[];
}

let mapFunctions: MapFunctions = {};
let objAvoided: HTMLElement[] = [];
let elementAvoided: string[] = [];
let keyPressed = false;

const parseValue = (value: unknown) => {
    if (typeof value === 'string') {
        return [value];
    } else if (Array.isArray(value)) {
        return value;
    }

    throw new Error('Unable to parse binding!');
};

const bindValue = (
    value: string[],
    el: HTMLElement,
    binding: DirectiveBinding,
    vnode: VNode
) => {
    const push = binding.modifiers.push === true;
    const avoid = binding.modifiers.avoid === true;
    const focus = !binding.modifiers.focus === true;
    const once = binding.modifiers.once === true;
    const prevent = binding.modifiers.prevent === true;
    const stop = binding.modifiers.stop === true;
    if (avoid) {
        objAvoided = objAvoided.filter((itm) => itm !== el);
        objAvoided.push(el);
    } else {
        mappingFunctions({
            value,
            push,
            once,
            focus,
            prevent,
            stop,
            vnode: vnode,
        });
    }
};

const emit = (vnode: VNode, name: string, data: any) => {
    let handlers: any =
        (vnode.data && vnode.data.on) ||
        (vnode.componentOptions && vnode.componentOptions.listeners);

    if (handlers && handlers[name] && typeof handlers[name] === 'function') {
        return handlers[name].fns(data);
    }
};

const emitAll = (vnodes: VNode[], name: string, data: any) => {
    for (let vnode of vnodes) {
        emit(vnode, name, data);
    }
};

const unbindValue = (value: string[], vnode: VNode) => {
    const k = encodeKey(value);

    const key = mapFunctions[k];
    const idxElm = key.vnodes.indexOf(vnode);
    if (key.vnodes.length > 1 && idxElm > -1) {
        key.vnodes.splice(idxElm, 1);
    } else {
        delete mapFunctions[k];
    }
};

const install = (V: typeof Vue, options: InstallOptions) => {
    elementAvoided = [...(options && options.ignore ? options.ignore : [])];
    V.directive('shortkey', {
        bind: (el: HTMLElement, binding: DirectiveBinding, vnode: VNode) => {
            // Mapping the commands
            const value = parseValue(binding.value);
            bindValue(value, el, binding, vnode);
        },
        update: (el, binding, vnode) => {
            const oldValue = parseValue(binding.oldValue);
            unbindValue(oldValue, vnode);

            const newValue = parseValue(binding.value);
            bindValue(newValue, el, binding, vnode);
        },
        unbind: (el, binding, vnode) => {
            const value = parseValue(binding.value);
            unbindValue(value, vnode);
        },
    });

    registerListeners();
};

const decodeKey = (pKey: KeyboardEvent) => createShortcutIndex(pKey);
const encodeKey = (pKey: string[]) => {
    const shortKey = {
        shiftKey: pKey.includes('shift'),
        // The Ctrl key is used for "ctrl-cmd" on non-Mac machines
        ctrlKey:
            pKey.includes('ctrl') || (!isMac() && pKey.includes('ctrl-cmd')),

        // The meta key is used for "ctrl-cmd" on Mac machines
        metaKey:
            pKey.includes('meta') || (isMac() && pKey.includes('ctrl-cmd')),

        altKey: pKey.includes('alt'),
    };

    let indexedKeys = createShortcutIndex(shortKey);
    const vKey = pKey.filter(
        (item) => !['shift', 'ctrl', 'meta', 'alt', 'ctrl-cmd'].includes(item)
    );
    indexedKeys += vKey.join('');
    return indexedKeys;
};

/**
 * Determines if the current device is a Mac.
 */
const isMac = () => {
    return /(Mac)/i.test(navigator.platform);
};

const createShortcutIndex = (pKey: Partial<KeyboardEvent>) => {
    let k = '';
    if (pKey.key === 'Shift' || pKey.shiftKey) {
        k += 'shift';
    }
    if (pKey.key === 'Control' || pKey.ctrlKey) {
        k += 'ctrl';
    }
    if (pKey.key === 'Meta' || pKey.metaKey) {
        k += 'meta';
    }
    if (pKey.key === 'Alt' || pKey.altKey) {
        k += 'alt';
    }
    if (pKey.key === 'ArrowUp') {
        k += 'arrowup';
    }
    if (pKey.key === 'ArrowLeft') {
        k += 'arrowleft';
    }
    if (pKey.key === 'ArrowRight') {
        k += 'arrowright';
    }
    if (pKey.key === 'ArrowDown') {
        k += 'arrowdown';
    }
    if (pKey.key === 'AltGraph') {
        k += 'altgraph';
    }
    if (pKey.key === 'Escape') {
        k += 'esc';
    }
    if (pKey.key === 'Enter') {
        k += 'enter';
    }
    if (pKey.key === 'Tab') {
        k += 'tab';
    }
    if (pKey.key === ' ') {
        k += 'space';
    }
    if (pKey.key === 'PageUp') {
        k += 'pageup';
    }
    if (pKey.key === 'PageDown') {
        k += 'pagedown';
    }
    if (pKey.key === 'Home') {
        k += 'home';
    }
    if (pKey.key === 'End') {
        k += 'end';
    }
    if (pKey.key === 'Delete') {
        k += 'del';
    }
    if (pKey.key === 'Backspace') {
        k += 'backspace';
    }
    if (pKey.key === 'Insert') {
        k += 'insert';
    }
    if (pKey.key === 'NumLock') {
        k += 'numlock';
    }
    if (pKey.key === 'CapsLock') {
        k += 'capslock';
    }
    if (pKey.key === 'Pause') {
        k += 'pause';
    }
    if (pKey.key === 'ContextMenu') {
        k += 'contextmenu';
    }
    if (pKey.key === 'ScrollLock') {
        k += 'scrolllock';
    }
    if (pKey.key === 'BrowserHome') {
        k += 'browserhome';
    }
    if (pKey.key === 'MediaSelect') {
        k += 'mediaselect';
    }
    if (
        (pKey.key && pKey.key !== ' ' && pKey.key.length === 1) ||
        /F\d{1,2}|\//g.test(pKey.key)
    )
        k += pKey.key.toLowerCase();
    return k;
};

const dispatchShortkeyEvent = (key: BoundKey, event: KeyboardEvent) => {
    emitAll(key.vnodes, 'shortkey', event);
};

const keyDown = (key: BoundKey, event: KeyboardEvent) => {
    if ((!key.once && !key.push) || (key.push && !keyPressed)) {
        dispatchShortkeyEvent(key, event);
    }
};

function registerListeners() {
    document.addEventListener(
        'keydown',
        (event) => {
            const decodedKey = decodeKey(event);
            // Check avoidable elements
            if (availableElement(decodedKey)) {
                const key = mapFunctions[decodedKey];
                if (key.prevent) {
                    event.preventDefault();
                }
                if (key.stop) {
                    event.stopPropagation();
                }
                if (key.focus) {
                    keyDown(key, event);
                    keyPressed = true;
                } else if (!keyPressed) {
                    const vnodes = key.vnodes;
                    if (vnodes.length > 0) {
                        const lastElement = vnodes[vnodes.length - 1].elm;
                        if (lastElement instanceof HTMLElement) {
                            lastElement.focus();
                        }
                    }
                    keyPressed = true;
                }
            }
        },
        true
    );

    document.addEventListener(
        'keyup',
        (event) => {
            const decodedKey = decodeKey(event);
            if (availableElement(decodedKey)) {
                const key = mapFunctions[decodedKey];
                if (key.prevent) {
                    event.preventDefault();
                }
                if (key.stop) {
                    event.stopPropagation();
                }
                if (key.once || key.push) {
                    dispatchShortkeyEvent(key, event);
                }
            }
            keyPressed = false;
        },
        true
    );
}

const mappingFunctions = (binding: BindingOutputs) => {
    const k = encodeKey(binding.value);

    let existing = mapFunctions[k];
    let vnodes: VNode[];
    let prevented = binding.prevent;
    let stopped = binding.stop;

    if (existing) {
        vnodes = existing.vnodes;
        prevented = binding.prevent || existing.prevent;
        stopped = binding.stop || existing.stop;
        vnodes.push(binding.vnode);
    } else {
        vnodes = [binding.vnode];
    }

    mapFunctions[k] = {
        value: binding.value,
        push: binding.push,
        once: binding.once,
        focus: binding.focus,
        prevent: prevented,
        stop: stopped,
        vnodes,
    };
};

const availableElement = (decodedKey: string) => {
    const objectIsAvoided = !!objAvoided.find(
        (r) => r === document.activeElement
    );
    const filterAvoided = !!elementAvoided.find(
        (selector) =>
            document.activeElement && document.activeElement.matches(selector)
    );
    return !!mapFunctions[decodedKey] && !(objectIsAvoided || filterAvoided);
};

export { install, decodeKey, encodeKey, keyDown };
