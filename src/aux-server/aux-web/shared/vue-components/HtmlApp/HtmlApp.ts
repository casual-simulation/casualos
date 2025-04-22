/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import type {
    UpdateHtmlAppAction,
    SerializableMutationRecord,
} from '@casual-simulation/aux-common';
import {
    Bot,
    getShortId,
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
    asyncResult,
    htmlAppEvent,
    RegisterHtmlAppAction,
    asyncError,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription, SubscriptionLike } from 'rxjs';
import type { BrowserSimulation } from '../../../../../aux-vm-browser';
import type { HtmlPortalSetupResult } from '@casual-simulation/aux-vm/portals/HtmlAppBackend';
import {
    TARGET_INPUT_PROPERTIES,
    ELEMENT_SPECIFIC_PROPERTIES,
} from '@casual-simulation/aux-vm/portals/HtmlAppConsts';
import { eventNames } from './Util';
import type { HtmlAppMethodCallAction } from '@casual-simulation/aux-common/bots/BotEvents';
import { getMediaForCasualOSUrl } from '../../MediaUtils';
import { parseCasualOSUrl } from '../../UrlUtils';

const DISALLOWED_NODE_NAMES = new Set(['SCRIPT']);
const DISALLOWED_EVENTS = new Set([
    'mousewheel',
    'wheel',
    'animationstart',
    'animationiteration',
    'animationend',
    'devicemotion',
    'deviceorientation',
    'deviceorientationabsolute',
]);

const ALLOWED_EVENTS = new Set([
    // TODO: Build complete list of allowed events
    // 'click',
    // 'mousedown',
    // 'mouseup',
    // 'mouseenter',
    // 'mouseleave',
    // 'touchstart',
    // 'touchend',
    // 'touchmove',
    // 'touchcancel',
    // 'keyup',
    // 'keydown',
    // ''
]);

const EVENT_OPTIONS = {
    capture: true,
    passive: true,
};

const MEDIA_COUNTER_SYMBOL = Symbol('mediaObservable');
const MEDIA_SUBSCRIPTION_SYMBOL = Symbol('mediaSubscription');

// Mostly taken from https://github.com/developit/preact-worker-demo/blob/bac36d7c34b241e4c041bcbdefaef77bcc5f367e/src/renderer/dom.js#L224
@Component({
    components: {},
})
export default class HtmlApp extends Vue {
    @Prop() simulationId: string;
    @Prop() appId: string;
    @Prop() taskId: string | number;

    private _simulation: BrowserSimulation;
    private _nodes: Map<string, Node>;
    private _mutationQueue: SerializableMutationRecord[][];
    private _mutationQueueTimer: any;
    private _currentTouch: any;
    private _sub: Subscription;
    private _listeners: Map<string, number> = new Map();
    private _isDestroyed: boolean; // Set by Vue
    private _isBeingDestroyed: boolean; // Set by Vue

    constructor() {
        super();
    }

    // uiHtmlElements(): HTMLElement[] {
    //     return [<HTMLElement>this.$refs.botQueue];
    // }

    mounted() {
        this._nodes = new Map();
        this._listeners = new Map();
        this._mutationQueue = [];
        this._simulation = _simulation(this.simulationId);
        this._sub = new Subscription();
        this._nodes.set(this.appId, this.$refs.container as Node);

        this._sub.add(
            this._simulation.localEvents.subscribe((e) => {
                if (e.type === 'update_html_app' && e.appId === this.appId) {
                    this._updatePortal(e);
                } else if (
                    e.type === 'html_app_method_call' &&
                    e.appId === this.appId
                ) {
                    this._callMethod(e);
                }
            })
        );

        this._proxyEvent = this._proxyEvent.bind(this);

        const container = this.$refs.container as any;
        if (eventNames.length <= 0) {
            for (let prop in container) {
                let eventName = prop.substring(2);
                if (
                    prop.startsWith('on') &&
                    prop === prop.toLowerCase() &&
                    !DISALLOWED_EVENTS.has(eventName) &&
                    (container[prop] === null ||
                        typeof container[prop] === 'function')
                ) {
                    eventNames.push(prop);
                }
            }
        }

        // Always listen for input events to prevent weird things from happening
        // with input-related events (like onkeydown)
        // Specific issue is that the value of the input is not set until just before the input event
        // is fired, and if we don't listen for the input event, then the actual value of the input element
        // won't be sent to the HtmlAppBackend
        this._applyEventListener({
            listenerName: 'input',
            listenerDelta: 1,
        });

        if (hasValue(this.taskId)) {
            this._simulation.helper.transaction(
                asyncResult(this.taskId, {
                    builtinEvents: eventNames,
                } as HtmlPortalSetupResult)
            );
        }
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _callMethod(event: HtmlAppMethodCallAction) {
        const node = this._nodes.get(event.nodeId);

        if (!node) {
            console.warn(
                `[HtmlApp] Unable to call .${event.methodName}() on nonexistant node!`
            );
            return;
        }

        try {
            let result = (node as any)[event.methodName].apply(
                node,
                event.args
            );

            if (result instanceof Promise) {
                result.then(
                    (r) => {
                        this._simulation.helper.transaction(
                            asyncResult(event.taskId, r, undefined, true)
                        );
                    },
                    (err) => {
                        this._simulation.helper.transaction(
                            asyncError(event.taskId, err.toString())
                        );
                    }
                );
            } else {
                this._simulation.helper.transaction(
                    asyncResult(event.taskId, result, undefined, true)
                );
            }
        } catch (err) {
            this._simulation.helper.transaction(
                asyncError(event.taskId, err.toString())
            );
        }
    }

    private _proxyEvent(event: Event) {
        if (ALLOWED_EVENTS.size > 0 && !ALLOWED_EVENTS.has(event.type)) {
            return;
        }

        let e: any = { type: event.type };
        if (event.target) {
            const anyTarget = <any>event.target;
            e.target = anyTarget.__id;

            for (let prop of TARGET_INPUT_PROPERTIES) {
                if (prop in anyTarget) {
                    e[`_target${prop}`] = anyTarget[prop];
                }
            }
            const propList = ELEMENT_SPECIFIC_PROPERTIES[anyTarget.nodeName];
            if (propList) {
                for (let prop of propList) {
                    if (prop in anyTarget) {
                        e[`_target${prop}`] = anyTarget[prop];
                    }
                }
            }
        }

        for (let prop in event) {
            let value = (<any>event)[prop];

            if (
                typeof value !== 'object' &&
                typeof value !== 'function' &&
                prop !== prop.toUpperCase() &&
                !Object.prototype.hasOwnProperty.call(e, prop)
            ) {
                e[prop] = value;
            }
        }

        this._simulation.helper.transaction(htmlAppEvent(this.appId, e));
    }

    private _createNode(skeleton: any): Node {
        let node: Node;
        if (skeleton.nodeType === 3) {
            node = document.createTextNode(skeleton.data);
        } else if (skeleton.nodeType === 1) {
            const nodeName = skeleton.namespaceURI
                ? skeleton.localName
                : skeleton.nodeName;
            if (DISALLOWED_NODE_NAMES.has(nodeName.toUpperCase())) {
                return null;
            }

            let el = (node = skeleton.namespace
                ? document.createElementNS(skeleton.namespace, nodeName)
                : skeleton.namespaceURI
                ? document.createElementNS(
                      skeleton.namespaceURI,
                      skeleton.localName ?? nodeName
                  )
                : document.createElement(nodeName));
            if (skeleton.className) {
                el.className = skeleton.className;
            }

            if (skeleton.style) {
                for (let prop in skeleton.style) {
                    if (
                        Object.prototype.hasOwnProperty.call(
                            skeleton.style,
                            prop
                        )
                    ) {
                        el.style[prop] = skeleton.style[prop];
                    }
                }
            }

            if (skeleton.attributes) {
                for (let attr of skeleton.attributes) {
                    this._setElementAttribute(el, attr.name, attr.value);
                }
            }

            if (skeleton.childNodes) {
                for (let child of skeleton.childNodes) {
                    let newNode = this._createNode(child);
                    if (newNode) {
                        el.appendChild(newNode);
                    }
                }
            }
        }
        (<any>node).__id = skeleton.__id;
        this._nodes.set(skeleton.__id, node);
        return node;
    }

    private _updatePortal(e: UpdateHtmlAppAction) {
        this._queueMutations(e.updates);
    }

    private _queueMutations(mutations: SerializableMutationRecord[]) {
        let queueWasEmpty = this._mutationQueue.length === 0;

        this._mutationQueue.push(mutations);

        if (queueWasEmpty && this._mutationQueue.length > 0) {
            this._requestProcessMutationQueue();
        }
    }

    private _processMutationQueue() {
        clearTimeout(this._mutationQueueTimer);
        let queue = this._mutationQueue;

        for (let mutations of queue) {
            for (let mutation of mutations) {
                try {
                    this._applyMutation(mutation);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        this._mutationQueue = [];
    }

    private _requestProcessMutationQueue() {
        clearTimeout(this._mutationQueueTimer);
        this._mutationQueueTimer = setTimeout(() => {
            this._processMutationQueue();
        }, 100);

        let requestIdleCallback = (<any>window).requestIdleCallback;
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => {
                this._processMutationQueue();
            });
        }
    }

    private _applyMutation(mutation: any) {
        if (this._isDestroyed || this._isBeingDestroyed) {
            return;
        }

        if (mutation.type === 'childList') {
            this._applyChildList(mutation);
        } else if (mutation.type === 'attributes') {
            this._applyAttributes(mutation);
        } else if (mutation.type === 'characterData') {
            this._applyCharacterData(mutation);
        } else if (mutation.type === 'event_listener') {
            this._applyEventListener(mutation);
        }
    }

    private _applyEventListener(mutation: any) {
        let { listenerName, listenerDelta } = mutation;

        const container = this.$refs.container as any;
        let currentCount = this._listeners.get(listenerName);
        if (!hasValue(currentCount) || currentCount < 0) {
            currentCount = 0;
        }
        const hadListener = currentCount > 0;
        currentCount += listenerDelta;
        const shouldHaveListener = currentCount > 0;

        if (!hadListener && shouldHaveListener) {
            container.addEventListener(
                listenerName,
                this._proxyEvent,
                EVENT_OPTIONS
            );
        } else if (hadListener && !shouldHaveListener) {
            container.removeEventListener(listenerName, this._proxyEvent);
        }

        this._listeners.set(listenerName, currentCount);
    }

    private _applyChildList(mutation: any) {
        let { target, removedNodes, addedNodes, previousSibling, nextSibling } =
            mutation;
        let parent = this._getNode(target);

        if (removedNodes) {
            for (let node of removedNodes) {
                try {
                    parent.removeChild(this._getNode(node));
                } catch (err) {
                    console.warn(err);
                }
            }
        }

        if (addedNodes) {
            for (let node of addedNodes) {
                let newNode = this._getNode(node);
                if (!newNode) {
                    newNode = this._createNode(node);
                }

                if (!newNode) {
                    continue;
                }
                parent.insertBefore(
                    newNode,
                    !!nextSibling ? this._getNode(nextSibling) : null
                );
            }
        }
    }

    private _applyAttributes(mutation: any) {
        let { target, attributeName } = mutation;
        let val: any;
        let hasAttribute = false;

        for (let p of target.attributes) {
            if (p.name === attributeName) {
                val = p.value;
                hasAttribute = val !== null && val !== undefined;
                break;
            }
        }
        let node = <Element>this._getNode(target);

        if (node) {
            if (hasAttribute) {
                this._setElementAttribute(node, attributeName, val);
            } else {
                node.removeAttribute(attributeName);
            }
        }
    }

    private _setElementAttribute(
        node: Element,
        attributeName: string,
        value: any
    ) {
        if (attributeName === 'style' && typeof value === 'object') {
            for (let prop in value) {
                if (Object.prototype.hasOwnProperty.call(value, prop)) {
                    (<any>node).style[prop] = value[prop];
                }
            }
        } else if (
            (node instanceof HTMLInputElement ||
                node instanceof HTMLTextAreaElement ||
                node instanceof HTMLSelectElement) &&
            (attributeName === 'value' || attributeName === 'checked')
        ) {
            if (attributeName === 'checked') {
                (<any>node)[attributeName] = value === true || value === 'true';
            } else {
                (<any>node)[attributeName] = value;
            }
        } else if (
            node instanceof HTMLOptionElement &&
            attributeName === 'selected'
        ) {
            (<any>node)[attributeName] = value === true || value === 'true';
        } else if (
            node instanceof HTMLVideoElement &&
            attributeName === 'src' &&
            typeof value === 'string'
        ) {
            const anyNode: any = node;
            const previousSub: Subscription =
                anyNode[MEDIA_SUBSCRIPTION_SYMBOL];
            if (previousSub) {
                previousSub.unsubscribe();
            }
            const casualOsUrl = parseCasualOSUrl(value);
            if (casualOsUrl) {
                // Quick and dirty way to cancel previous media streams
                const gen: number = (anyNode[MEDIA_COUNTER_SYMBOL] || 0) + 1;
                anyNode[MEDIA_COUNTER_SYMBOL] = gen;
                getMediaForCasualOSUrl(casualOsUrl).then((media) => {
                    if (anyNode[MEDIA_COUNTER_SYMBOL] !== gen) {
                        return;
                    }
                    if (media) {
                        node.srcObject = media;
                        const previousSub: Subscription =
                            anyNode[MEDIA_SUBSCRIPTION_SYMBOL];
                        previousSub?.unsubscribe();
                        anyNode[MEDIA_SUBSCRIPTION_SYMBOL] = new Subscription(
                            () => {
                                if (media instanceof MediaStream) {
                                    console.log('unsub');
                                    for (let track of media.getTracks()) {
                                        track.stop();
                                    }
                                }
                            }
                        );
                    } else {
                        node.setAttribute(attributeName, value);
                    }
                });
            } else {
                node.setAttribute(attributeName, value);
            }
        } else {
            node.setAttribute(attributeName, value);
        }
    }

    private _applyCharacterData(mutation: any) {
        let { target, oldValue } = mutation;
        let node = this._getNode(target);
        if (node) {
            node.nodeValue = target.data;
        }
    }

    private _getNode(node: any) {
        if (!node) {
            return null;
        }
        if (node.nodeName === 'BODY' || node.localName === 'body') {
            return this.$refs.container as Element;
        }
        return this._nodes.get(node.__id);
    }
}

function _simulation(id: string): BrowserSimulation {
    return appManager.simulationManager.simulations.get(id);
}
