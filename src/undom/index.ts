// copied from https://github.com/developit/preact-worker-demo/blob/bac36d7c34b241e4c041bcbdefaef77bcc5f367e/src/lib/undom.js

import {
    assign,
    toLower,
    splice,
    findWhere,
    setImmediate,
    createAttributeFilter,
} from './util';

/*
const NODE_TYPES = {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    COMMENT_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    DOCUMENT_NODE: 9
};
*/

export interface UndomOptions {
    /**
     * The list of event names that should be added to the Node class.
     */
    builtinEvents?: string[];
}

/** Create a minimally viable DOM Document
 *	@returns {Document} document
 */
export default function undom(options: UndomOptions = {}): globalThis.Document {
    let observers = [] as MutationObserver[],
        pendingMutations = false;

    let pauseMutations = false;

    class Node {
        nodeType: number;
        nodeName: string;
        childNodes: Node[];
        parentNode: Node;
        children?: Element[];

        constructor(nodeType: number, nodeName: string) {
            this.nodeType = nodeType;
            this.nodeName = nodeName;
            this.childNodes = [];
        }

        get nextSibling(): Node {
            if (this.parentNode) {
                let siblingIndex = this.parentNode.childNodes.indexOf(this) + 1;
                if (siblingIndex < this.parentNode.childNodes.length) {
                    return this.parentNode.childNodes[siblingIndex];
                }
            }

            return null;
        }

        get previousSibling(): Node {
            if (this.parentNode) {
                let siblingIndex = this.parentNode.childNodes.indexOf(this) - 1;
                if (siblingIndex >= 0) {
                    return this.parentNode.childNodes[siblingIndex];
                }
            }

            return null;
        }

        appendChild(child: Node) {
            try {
                if (child.parentNode === this) {
                    pauseMutations = true;
                }
                child.remove();
            } finally {
                if (child.parentNode === this) {
                    pauseMutations = false;
                }
            }
            child.parentNode = this;
            this.childNodes.push(child);
            if (this.children && child.nodeType === 1)
                this.children.push(<Element>child);
            mutation(this, 'childList', {
                addedNodes: [child],
                removedNodes: [],
                previousSibling: this.childNodes[this.childNodes.length - 2],
            });
        }

        insertBefore(child: Node, ref: Node) {
            child.remove();
            let i = splice(this.childNodes, ref, child),
                ref2;
            if (!ref) {
                this.appendChild(child);
            } else {
                if (~i && child.nodeType === 1) {
                    while (
                        (i < this.childNodes.length &&
                            (ref2 = this.childNodes[i]).nodeType !== 1) ||
                        ref === child
                    )
                        i++;
                    if (ref2) splice(this.children, ref, child);
                }
                child.parentNode = this;
                mutation(this, 'childList', {
                    addedNodes: [child],
                    removedNodes: [],
                    nextSibling: ref,
                });
            }
        }
        replaceChild(child: Node, ref: Node) {
            if (ref.parentNode === this) {
                this.insertBefore(child, ref);
                ref.remove();
            }
        }
        removeChild(child: Node) {
            let i = splice(this.childNodes, child);
            child.parentNode = null;
            if (child.nodeType === 1) {
                splice(this.children, child);
            }
            mutation(this, 'childList', {
                addedNodes: [],
                removedNodes: [child],
                previousSibling: this.childNodes[i - 1],
                nextSibling: this.childNodes[i],
            });
        }

        remove() {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        }
    }

    if (options.builtinEvents) {
        for (let event of options.builtinEvents) {
            Object.defineProperty(Node.prototype, event, {
                get: () => {},
                set: () => {},
                enumerable: true,
            });
        }
    }

    class Text extends Node {
        private _data: string;

        data: string;

        constructor(text: string) {
            super(3, '#text'); // TEXT_NODE
            // this.textContent = this.nodeValue = text;
            this._data = text;
            Object.defineProperty(this, 'data', {
                get: () => this._data,
                set: (text) => {
                    const oldValue = this._data;
                    this._data = text;
                    mutation(this, 'characterData', { oldValue });
                },
                enumerable: true,
            });
        }

        get textContent() {
            return this.data;
        }

        set textContent(value) {
            this.data = value;
        }

        get nodeValue() {
            return this.data;
        }

        set nodeValue(value) {
            this.data = value;
        }
    }

    interface Attr {}

    class Element extends Node {
        private _style: any;

        attributes: Attr[];
        style: any;
        __handlers: any;
        namespace: string;

        private _createStyleProxy(value: any): any {
            return new Proxy(value, {
                set: (target, key, value) => {
                    let result = Reflect.set(target, key, value);
                    this.setAttribute('style', this._style);
                    return result;
                },
            });
        }

        constructor(nodeType: number, nodeName: string) {
            super(nodeType || 1, nodeName); // ELEMENT_NODE
            this.attributes = [];
            this.children = [];
            this.__handlers = {};
            this._style = this._createStyleProxy({});
            Object.defineProperty(this, 'style', {
                get: () => this._style,
                set: (style) => {
                    this._style = this._createStyleProxy(style);
                    this.setAttribute('style', this._style);
                },
                enumerable: true,
            });
            Object.defineProperty(this, 'className', {
                set: (val) => {
                    this.setAttribute('class', val);
                },
                get: () => this.getAttribute('style'),
            });
            Object.defineProperty(this.style, 'cssText', {
                set: (val) => {
                    this.setAttribute('style', val);
                },
                get: () => this.getAttribute('style'),
            });
        }

        setAttribute(key: string, value: any) {
            this.setAttributeNS(null, key, value);
        }
        getAttribute(key: string) {
            return this.getAttributeNS(null, key);
        }
        removeAttribute(key: string) {
            this.removeAttributeNS(null, key);
        }

        setAttributeNS(ns: string, name: string, value: any) {
            let attr = findWhere(
                    this.attributes,
                    createAttributeFilter(ns, name)
                ),
                oldValue = attr && attr.value;
            if (!attr) this.attributes.push((attr = { ns, name }));
            attr.value =
                typeof value === 'object' ? { ...value } : String(value ?? '');
            mutation(this, 'attributes', {
                attributeName: name,
                attributeNamespace: ns,
                oldValue,
            });
        }
        getAttributeNS(ns: string, name: string) {
            let attr = findWhere(
                this.attributes,
                createAttributeFilter(ns, name)
            );
            return attr && attr.value;
        }
        removeAttributeNS(ns: string, name: string) {
            splice(this.attributes, createAttributeFilter(ns, name));
            mutation(this, 'attributes', {
                attributeName: name,
                attributeNamespace: ns,
                oldValue: this.getAttributeNS(ns, name),
            });
        }

        addEventListener(type: string, handler: (event: Event) => void) {
            (this.__handlers[type] || (this.__handlers[type] = [])).push(
                handler
            );
            mutation(null, 'event_listener', {
                listenerName: type,
                listenerDelta: 1,
            });
        }
        removeEventListener(type: string, handler: (event: Event) => void) {
            let index = splice(this.__handlers[type], handler, undefined, true);
            if (index >= 0) {
                mutation(null, 'event_listener', {
                    listenerName: type,
                    listenerDelta: -1,
                });
            }
        }
        dispatchEvent(event: Event) {
            let t = (event.currentTarget = this as Element),
                c = event.cancelable,
                l,
                i;
            do {
                l = t.__handlers && t.__handlers[toLower(event.type)];
                if (l)
                    for (i = l.length; i--; ) {
                        if ((l[i].call(t, event) === false || event._end) && c)
                            break;
                    }
            } while (
                event.bubbles &&
                !(c && event._stop) &&
                (event.target = t = t.parentNode as Element)
            );
            return !event.defaultPrevented;
        }
    }

    class InputElement extends Element {
        constructor(nodeType: number, nodeName: string) {
            super(nodeType, nodeName);
            this.setAttribute('value', '');
            Object.defineProperty(this, 'value', {
                set: (val) => {
                    this.setAttribute('value', val);
                },
                get: () => this.getAttribute('value'),
            });
        }
    }

    class SVGElement extends Element {}

    class Document extends Element {
        defaultView: any;
        body: Element;
        head: Element;

        constructor() {
            super(9, '#document'); // DOCUMENT_NODE
        }
    }

    class Event {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        defaultPrevented: boolean;
        currentTarget: any;
        target: any;
        _stop: boolean;
        _end: boolean;

        constructor(
            type: string,
            opts: { bubbles?: boolean; cancelable?: boolean }
        ) {
            this.type = type;
            this.bubbles = !!opts?.bubbles;
            this.cancelable = !!opts?.cancelable;
        }
        stopPropagation() {
            this._stop = true;
        }
        stopImmediatePropagation() {
            this._end = this._stop = true;
        }
        preventDefault() {
            this.defaultPrevented = true;
        }
    }

    interface MutationRecord {
        target: Node;
        type: string;
        addedNodes: Node[];
        removedNodes: Node[];
        previousSibling: Node;
        nextSibling: Node;
        oldValue: any;

        attributeName: string;
        attributeNamespace: string;
    }

    function mutation(
        target: Node,
        type: string,
        record: Partial<MutationRecord> & {
            /**
             * The name of the event listener.
             */
            listenerName?: string;

            /**
             * The number of event listeners that were added (positive number) or removed (negative number).
             */
            listenerDelta?: number;
        }
    ) {
        if (pauseMutations) {
            return;
        }
        record.target = target;
        record.type = type;

        for (let i = observers.length; i--; ) {
            let ob = observers[i],
                match =
                    (!target && ob._options.subtree) || target === ob._target;
            if (!match && ob._options.subtree) {
                do {
                    if ((match = target === ob._target)) break;
                } while ((target = target.parentNode));
            }
            if (match) {
                ob._records.push(record as MutationRecord);
                if (!pendingMutations) {
                    pendingMutations = true;
                    setImmediate(flushMutations);
                }
            }
        }
    }

    function flushMutations() {
        pendingMutations = false;
        for (let i = observers.length; i--; ) {
            let ob = observers[i];
            if (ob._records.length) {
                ob.callback(ob.takeRecords());
            }
        }
    }

    class MutationObserver {
        callback: (records: MutationRecord[]) => void;
        _records: MutationRecord[];
        _target: any;
        _options: any;

        constructor(callback: (records: MutationRecord[]) => void) {
            this.callback = callback;
            this._records = [];
        }
        observe(target: any, options: any) {
            this.disconnect();
            this._target = target;
            this._options = options || {};
            observers.push(this);
        }
        disconnect() {
            this._target = null;
            splice(observers, this);
        }
        takeRecords() {
            return this._records.splice(0, this._records.length);
        }
    }

    function createElement(type: string) {
        const typeUpper = String(type).toUpperCase();
        if (typeUpper === 'INPUT') {
            return new InputElement(null, typeUpper);
        }
        return new Element(null, typeUpper);
    }

    function createElementNS(ns: string, type: string) {
        let element = createElement(type);
        element.namespace = ns;
        return element;
    }

    function createTextNode(text: string) {
        return new Text(text);
    }

    function createDocument() {
        let document = new Document();
        assign(
            document,
            (document.defaultView = {
                document,
                MutationObserver,
                Document,
                Node,
                Text,
                Element,
                InputElement,
                SVGElement,
                Event,
            })
        );
        assign(document, {
            documentElement: document,
            createElement,
            createElementNS,
            createTextNode,
        });
        document.appendChild((document.head = createElement('head')));
        document.appendChild((document.body = createElement('body')));
        return document;
    }

    return createDocument() as any;
}
