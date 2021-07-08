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
    UpdateHtmlPortalAction,
    SerializableMutationRecord,
    asyncResult,
    htmlPortalEvent,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription, SubscriptionLike } from 'rxjs';
import { BrowserSimulation } from '../../../../../aux-vm-browser';
import { getNodeMajorVersion } from '../../../../../aux-custom-portals/monaco/typescript/lib/typescriptServices';

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
export default class HtmlPortal extends Vue {
    @Prop() simulationId: string;
    @Prop() portalId: string;
    @Prop() taskId: string | number;

    private _simulation: BrowserSimulation;
    private _nodes: Map<string, Node>;
    private _mutationQueue: SerializableMutationRecord[];
    private _mutationQueueTimer: any;
    private _currentTouch: any;
    private _sub: Subscription;

    constructor() {
        super();
    }

    // uiHtmlElements(): HTMLElement[] {
    //     return [<HTMLElement>this.$refs.botQueue];
    // }

    mounted() {
        this._nodes = new Map();
        this._mutationQueue = [];
        this._simulation = _simulation(this.simulationId);
        this._sub = new Subscription();

        this._sub.add(
            this._simulation.localEvents.subscribe((e) => {
                if (
                    e.type === 'update_html_portal' &&
                    e.portalId === this.portalId
                ) {
                    this._updatePortal(e);
                }
            })
        );

        const container = this.$refs.container as any;
        for (let prop in container) {
            let eventName = prop.substring(2);
            if (
                prop.startsWith('on') &&
                prop === prop.toLowerCase() &&
                !DISALLOWED_EVENTS.has(eventName) &&
                (container[prop] === null ||
                    typeof container[prop] === 'function')
            ) {
                container.addEventListener(
                    eventName,
                    (e: Event) => {
                        return this._proxyEvent(e);
                    },
                    EVENT_OPTIONS
                );
            }
        }

        if (hasValue(this.taskId)) {
            this._simulation.helper.transaction(asyncResult(this.taskId, null));
        }
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    private _proxyEvent(event: Event) {
        // if(event.type === 'click' && this._currentTouch) {
        //     return false;
        // }

        if (ALLOWED_EVENTS.size > 0 && !ALLOWED_EVENTS.has(event.type)) {
            return;
        }

        let e: any = { type: event.type };
        if (event.target) {
            e.target = (<any>event.target).__id;
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

        this._simulation.helper.transaction(htmlPortalEvent(this.portalId, e));

        // if (event.type === 'touchstart') {
        //     this._currentTouch = this._getTouch(event as TouchEvent);
        // } else if(event.type === 'touchend' && this._currentTouch) {
        //     let touch = this._getTouch(event as TouchEvent);
        //     if (touch) {

        //     }
        // }
    }

    private _getTouch(event: TouchEvent) {
        let t: any =
            (event.changedTouches && event.changedTouches[0]) ||
            (event.touches && event.touches[0]) ||
            event;
        return t && { pageX: t.pageX, pageY: t.pageY };
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
                    el.setAttribute(attr.name, attr.value);
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

    private _updatePortal(e: UpdateHtmlPortalAction) {
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
            this._applyMutation(mutation);
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
        }
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
                parent.removeChild(this._getNode(node));
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

        for (let p of target.attributes) {
            if (p.name === attributeName) {
                val = p.value;
                break;
            }
        }
        (<Element>this._getNode(target))?.setAttribute(attributeName, val);
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
