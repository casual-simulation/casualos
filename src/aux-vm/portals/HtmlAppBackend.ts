import {
    action,
    asyncResult,
    hasValue,
    ON_APP_SETUP_ACTION_NAME,
    registerHtmlApp,
    SerializableMutationRecord,
    updateHtmlApp,
    unregisterHtmlApp,
    htmlAppMethod,
} from '@casual-simulation/aux-common';
import { AuxHelper } from '../vm';
import { AppBackend } from './AppBackend';
import { v4 as uuid } from 'uuid';
import type { RootNode } from '@casual-simulation/undom';
import undom, {
    BUILTIN_HTML_CANVAS_ELEMENT_FUNCTIONS,
    BUILTIN_HTML_ELEMENT_VOID_FUNCTIONS,
    BUILTIN_HTML_ELEMENT_PROMISE_FUNCTIONS,
    registerMethodHandler,
    supressMutations,
} from '@casual-simulation/undom';
import { render } from 'preact';
import { BehaviorSubject, Subscription } from 'rxjs';
import { first, map } from 'rxjs/operators';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';
import {
    ELEMENT_NODE,
    ELEMENT_SPECIFIC_PROPERTIES,
    NODE_REFERENCE_PROPERTIES,
    TARGET_INPUT_PROPERTIES,
    TEXT_NODE,
    TEXT_REFERENCE_PROPERTIES,
} from './HtmlAppConsts';

export interface HtmlPortalSetupResult {
    builtinEvents: string[];
}

/**
 * Defines a class that is used to communicate HTML changes for a custom html portal.
 */
export class HtmlAppBackend implements AppBackend {
    appId: string;
    botId: string;

    private _helper: AuxHelper;
    private _sub: Subscription;
    private _initTaskId: string;
    private _registerTaskId: string | number;
    private _instanceId: string;
    private _document: Document;
    private _mutationObserver: MutationObserver;
    private _nodes: Map<string, RootNode> = new Map<string, RootNode>();
    private _initialContent: any;
    private _setupObservable: BehaviorSubject<boolean>;
    private _methodCallTasks: Map<number | string, (result: any) => void> =
        new Map();

    /**
     * the list of properties that should be disallowed.
     * Taken from https://github.com/developit/preact-worker-demo/blob/master/src/renderer/worker.js
     */
    private _propDenylist: Set<string> = new Set([
        'children',
        'parentNode',
        '__handlers',
        '_component',
        '_componentConstructor',
        'l',
    ]);

    private _propCopyList: Set<string> = new Set(['style']);

    /**
     * The list of properties that should be converted to references.
     * Taken from https://github.com/developit/preact-worker-demo/blob/master/src/renderer/worker.js
     */
    private _propReferenceList: Set<string> = new Set([
        'target',
        'addedNodes',
        'removedNodes',
        'nextSibling',
        'previousSibling',
    ]);

    private _idCounter = 0;

    get onSetup() {
        return this._setupObservable.pipe(
            first((setup) => !!setup),
            map(() => {})
        );
    }

    get document() {
        return this._document;
    }

    constructor(
        appId: string,
        botId: string,
        helper: AuxHelper,
        registerTaskId?: string | number,
        instanceId?: string
    ) {
        this.appId = appId;
        this.botId = botId;
        this._registerTaskId = registerTaskId;
        this._sub = new Subscription();
        this._sub.add(() => {
            this._renderContent('');
            this._helper.transaction(
                unregisterHtmlApp(this.appId, this._instanceId)
            );
        });

        this._helper = helper;
        this._setupObservable = new BehaviorSubject(false);

        this._initTaskId = uuid();
        this._instanceId = instanceId ?? uuid();
        this._helper.transaction(
            registerHtmlApp(this.appId, this._instanceId, this._initTaskId)
        );
    }

    handleEvents(events: RuntimeActions[]): void {
        for (let event of events) {
            if (event.type === 'async_result') {
                if (event.taskId === this._initTaskId) {
                    this._setupApp(event.result as HtmlPortalSetupResult);
                } else if (this._methodCallTasks.has(event.taskId)) {
                    this._methodCallTasks.get(event.taskId)(event.result);
                }
            } else if (event.type === 'html_app_event') {
                if (event.appId === this.appId) {
                    let target = this._getNode(event.event.target);
                    if (target && target.dispatchEvent) {
                        let finalEvent = {
                            ...event.event,
                            target: target,
                            bubbles: true,
                        };

                        try {
                            supressMutations(true);
                            for (let prop of TARGET_INPUT_PROPERTIES) {
                                let eventPropName = `_target${prop}`;
                                if (eventPropName in finalEvent) {
                                    (<any>target)[prop] =
                                        finalEvent[eventPropName];
                                }
                            }
                            const propList =
                                ELEMENT_SPECIFIC_PROPERTIES[target.nodeName];
                            if (propList) {
                                for (let prop of propList) {
                                    let eventPropName = `_target${prop}`;
                                    if (eventPropName in finalEvent) {
                                        (<any>target)[prop] =
                                            finalEvent[eventPropName];
                                    }
                                }
                            }
                        } finally {
                            supressMutations(false);
                        }

                        try {
                            target.dispatchEvent(finalEvent);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            } else if (event.type === 'set_app_output') {
                if (event.appId === this.appId) {
                    if (typeof event.output === 'object') {
                        if (!this._document) {
                            this._initialContent = event.output;
                            continue;
                        }

                        this._renderContent(event.output);
                    }
                }
            }
        }
    }

    dispose(): void {
        this._sub.unsubscribe();
    }

    private _renderContent(content: any) {
        let prevDocument = globalThis.document;
        try {
            globalThis.document = this._document;
            if (this._document) {
                render(content, this._document.body);
            }
        } catch (err) {
            console.error(err);
        } finally {
            globalThis.document = prevDocument;
        }
    }

    private _getNode(node: any): RootNode {
        let id: string;
        if (node && typeof node === 'object') {
            id = node.__id;
        } else if (typeof node === 'string') {
            id = node;
        }
        if (!id) {
            return null;
        }

        if (node.nodeName === 'BODY') {
            return this._document.body as any;
        }
        return this._nodes.get(id);
    }

    private _setupApp(result: HtmlPortalSetupResult) {
        try {
            let doc = (this._document = undom({
                builtinEvents: result?.builtinEvents,
            }));

            this._registerMethodHandlers(doc);

            this._mutationObserver = new doc.defaultView.MutationObserver(
                this._processMutations.bind(this)
            );
            this._mutationObserver.observe(doc, {
                subtree: true,
            });

            this._helper.transaction(
                action(ON_APP_SETUP_ACTION_NAME, [this.botId], undefined, {
                    document: this._document,
                })
            );

            if (this._initialContent) {
                this._renderContent(this._initialContent);
            }

            if (hasValue(this._registerTaskId)) {
                this._helper.transaction(
                    asyncResult(this._registerTaskId, null)
                );
            }
        } finally {
            this._setupObservable.next(true);
        }
    }

    private _registerMethodHandlers(doc: Document) {
        for (let method of BUILTIN_HTML_ELEMENT_VOID_FUNCTIONS) {
            this._registerVoidMethodHandler(doc, 'HTMLElement', method);
        }

        for (let method of BUILTIN_HTML_ELEMENT_PROMISE_FUNCTIONS) {
            this._registerPromiseMethodHandler(doc, 'HTMLElement', method);
        }

        const inputElemenetFunctions = [
            'select',
            'setCustomValidity',
            'setRangeText',
            'setSelectionRange',
            'showPicker',
            'stepDown',
            'stepUp',
        ];
        for (let method of inputElemenetFunctions) {
            this._registerVoidMethodHandler(doc, 'HTMLInputElement', method);
        }

        const formElementFunctions = ['reset', 'submit'];
        for (let method of formElementFunctions) {
            this._registerPromiseMethodHandler(doc, 'HTMLFormElement', method);
        }

        const mediaElementVoidFunctions = ['fastSeek', 'load', 'pause'];
        const mediaElementPromiseFunctions = ['play'];

        for (let method of mediaElementPromiseFunctions) {
            this._registerPromiseMethodHandler(doc, 'HTMLMediaElement', method);
        }

        for (let method of mediaElementVoidFunctions) {
            this._registerVoidMethodHandler(doc, 'HTMLMediaElement', method);
        }

        const videoElementFunctions = [
            // 'getVideoPlaybackQuality',
            'requestPictureInPicture',
        ];
        for (let method of videoElementFunctions) {
            this._registerPromiseMethodHandler(doc, 'HTMLVideoElement', method);
        }

        for (let method of BUILTIN_HTML_CANVAS_ELEMENT_FUNCTIONS) {
            this._registerPromiseMethodHandler(
                doc,
                'HTMLCanvasElement',
                method
            );
        }
    }

    private _registerVoidMethodHandler(
        doc: Document,
        className: string,
        methodName: string
    ) {
        this._sub.add(
            registerMethodHandler(
                doc,
                className,
                methodName,
                (el, method, args) => {
                    this._emitMethodCall(el, methodName, args);
                    return undefined;
                }
            )
        );
    }

    private _registerPromiseMethodHandler(
        doc: Document,
        className: string,
        methodName: string
    ) {
        this._sub.add(
            registerMethodHandler(
                doc,
                className,
                methodName,
                (el, method, args) => {
                    return this._emitMethodCall(el, methodName, args);
                }
            )
        );
    }

    private _emitMethodCall(
        element: any,
        methodName: string,
        args: any[]
    ): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const taskId = uuid();

            this._methodCallTasks.set(taskId, (result) => {
                this._methodCallTasks.delete(taskId);
                resolve(result);
            });

            try {
                this._helper.transaction(
                    htmlAppMethod(
                        this.appId,
                        this._getNodeId(element),
                        methodName,
                        args,
                        taskId
                    )
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    private _processMutations(mutations: MutationRecord[]) {
        for (let mutation of mutations) {
            for (let prop of this._propReferenceList) {
                (<any>mutation)[prop] = this._makeReference(
                    (<any>mutation)[prop]
                );
            }
        }

        this._helper.transaction(updateHtmlApp(this.appId, mutations as any[]));
    }

    private _getNodeId(obj: RootNode) {
        let id = (<any>obj).__id;
        if (!id) {
            id = (<any>obj).__id = (this._idCounter++).toString();
        }
        this._nodes.set(id, obj);
        return id;
    }

    // Mostly copied from https://github.com/developit/preact-worker-demo/blob/bac36d7c34b241e4c041bcbdefaef77bcc5f367e/src/renderer/worker.js#L81
    private _makeReference(obj: RootNode | RootNode[]): any {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(this._makeReference, this);
        }

        const anyObj = obj as any;
        let id = anyObj.__id;
        if (!id) {
            id = anyObj.__id = (this._idCounter++).toString();
        }
        this._nodes.set(id, obj);

        let result = {
            __id: id,
            nodeType: obj.nodeType,
        } as any;

        if (obj.nodeType === 3) {
            for (let prop of TEXT_REFERENCE_PROPERTIES) {
                result[prop] = anyObj[prop];
            }
        } else if (obj.nodeType === 1) {
            for (let prop of NODE_REFERENCE_PROPERTIES) {
                if (!prop.startsWith('_') || prop === '__id') {
                    const value = anyObj[prop];
                    if (hasValue(value)) {
                        if (this._propCopyList.has(prop)) {
                            result[prop] = { ...value };
                        } else {
                            result[prop] = value;
                        }
                    }
                }
            }

            if (anyObj.childNodes) {
                result.childNodes = this._makeReference(anyObj.childNodes);
            }
        }

        return result;
    }
}
