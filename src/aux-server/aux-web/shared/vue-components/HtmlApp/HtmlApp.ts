import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import {
    Bot,
    getShortId,
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
    UpdateHtmlAppAction,
    SerializableMutationRecord,
    asyncResult,
    htmlAppEvent,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription, SubscriptionLike } from 'rxjs';
import { BrowserSimulation } from '../../../../../aux-vm-browser';
import {
    HtmlPortalSetupResult,
    TARGET_INPUT_PROPERTIES,
} from '@casual-simulation/aux-vm/portals/HtmlAppBackend';

const DISALLOWED_NODE_NAMES = new Set(['script']);
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
    private _mutationQueue: SerializableMutationRecord[];
    private _mutationQueueTimer: any;
    private _currentTouch: any;
    private _sub: Subscription;
    private _listeners: Map<string, number> = new Map();

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

        this._sub.add(
            this._simulation.localEvents.subscribe((e) => {
                if (e.type === 'update_html_app' && e.appId === this.appId) {
                    this._updatePortal(e);
                }
            })
        );

        this._proxyEvent = this._proxyEvent.bind(this);

        const container = this.$refs.container as any;
        let eventNames = [] as string[];
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
        }

        for (let prop in event) {
            let value = (<any>event)[prop];

            if (
                typeof value !== 'object' &&
                typeof value !== 'function' &&
                prop !== prop.toUpperCase() &&
                !e.hasOwnProperty(prop)
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
            if (DISALLOWED_NODE_NAMES.has(skeleton.nodeName)) {
                return null;
            }

            let el = (node = document.createElement(skeleton.nodeName));
            if (skeleton.className) {
                el.className = skeleton.className;
            }

            if (skeleton.style) {
                for (let prop in skeleton.style) {
                    if (skeleton.style.hasOwnProperty(prop)) {
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
        for (let m of e.updates) {
            this._queueMutation(m);
        }
    }

    private _queueMutation(mutation: SerializableMutationRecord) {
        let queueWasEmpty = this._mutationQueue.length === 0;
        let added = false;
        if (
            mutation.type === 'characterData' ||
            mutation.type === 'attributes'
        ) {
            for (let i = this._mutationQueue.length - 1; i > 0; i--) {
                let m = this._mutationQueue[i];
                if (
                    m.type === mutation.type &&
                    m.target.__id === mutation.target.__id
                ) {
                    if (m.type === 'attributes') {
                        this._mutationQueue.splice(i + 1, 0, mutation);
                    } else {
                        this._mutationQueue[i] = mutation;
                    }
                    added = true;
                }
            }
        }

        if (!added) {
            this._mutationQueue.push(mutation);
        }

        if (queueWasEmpty && this._mutationQueue.length > 0) {
            this._requestProcessMutationQueue();
        }
    }

    private _processMutationQueue() {
        clearTimeout(this._mutationQueueTimer);
        let queue = this._mutationQueue;

        for (let mutation of queue) {
            try {
                this._applyMutation(mutation);
            } catch (e) {
                console.error(e);
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
        let { target, listenerName, listenerDelta } = mutation;

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
        let {
            target,
            removedNodes,
            addedNodes,
            previousSibling,
            nextSibling,
        } = mutation;
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
                hasAttribute = true;
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
                if (value.hasOwnProperty(prop)) {
                    (<any>node).style[prop] = value[prop];
                }
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
        if (node.nodeName === 'BODY') {
            return this.$refs.container as Element;
        }
        return this._nodes.get(node.__id);
    }
}

function _simulation(id: string): BrowserSimulation {
    return appManager.simulationManager.simulations.get(id);
}
