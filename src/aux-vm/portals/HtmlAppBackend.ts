import {
    action,
    asyncResult,
    AuxRuntime,
    Bot,
    BotAction,
    hasValue,
    ON_APP_SETUP_ACTION_NAME,
    registerHtmlApp,
    SerializableMutationRecord,
    updateHtmlApp,
    unregisterHtmlApp,
} from '@casual-simulation/aux-common';
import { AuxHelper } from '../vm';
import { AppBackend } from './AppBackend';
import { v4 as uuid } from 'uuid';
import undom, { supressMutations } from '@casual-simulation/undom';
import { render } from 'preact';

export const TARGET_INPUT_PROPERTIES = ['value', 'checked'];

/**
 * Properties that should automatically be copied for specific tag types.
 * For performance, these properties are only copied if an event is sent for the element with the element as the target.
 */
export const ELEMENT_SPECIFIC_PROPERTIES: { [nodeName: string]: string[] } = {
    IMG: ['width', 'height', 'naturalWidth', 'naturalHeight', 'currentSrc'],
    VIDEO: ['videoWidth', 'videoHeight', 'duration', 'currentSrc'],
    SECTION: ['scrollTop', 'offsetHeight'],
};

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
    private _initTaskId: string;
    private _registerTaskId: string | number;
    private _instanceId: string;
    private _document: Document;
    private _mutationObserver: MutationObserver;
    private _nodes: Map<string, Node> = new Map<string, Node>();
    private _initialContent: any;

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

        this._helper = helper;

        this._initTaskId = uuid();
        this._instanceId = instanceId ?? uuid();
        this._helper.transaction(
            registerHtmlApp(this.appId, this._instanceId, this._initTaskId)
        );
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'async_result') {
                if (event.taskId === this._initTaskId) {
                    this._setupApp(event.result as HtmlPortalSetupResult);
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
        this._helper.transaction(
            unregisterHtmlApp(this.appId, this._instanceId)
        );
    }

    private _renderContent(content: any) {
        let prevDocument = globalThis.document;
        try {
            globalThis.document = this._document;
            render(content, this._document.body);
        } catch (err) {
            console.error(err);
        } finally {
            globalThis.document = prevDocument;
        }
    }

    private _getNode(node: any): Node {
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
            return document.body;
        }
        return this._nodes.get(id);
    }

    private _setupApp(result: HtmlPortalSetupResult) {
        let doc = (this._document = undom({
            builtinEvents: result?.builtinEvents,
        }));

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
            this._helper.transaction(asyncResult(this._registerTaskId, null));
        }
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

    // Mostly copied from https://github.com/developit/preact-worker-demo/blob/bac36d7c34b241e4c041bcbdefaef77bcc5f367e/src/renderer/worker.js#L81
    private _makeReference(obj: any): any {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(this._makeReference, this);
        }

        if (obj instanceof this._document.defaultView.Node) {
            let id = (<any>obj).__id;
            if (!id) {
                id = (<any>obj).__id = (this._idCounter++).toString();
            }
            this._nodes.set(id, obj);
        }

        let result = {} as any;
        for (let prop in obj) {
            if (
                obj.hasOwnProperty(prop) &&
                !this._propDenylist.has(prop) &&
                (!prop.startsWith('_') || prop === '__id')
            ) {
                if (this._propCopyList.has(prop)) {
                    result[prop] = { ...(<any>obj)[prop] };
                } else {
                    result[prop] = (<any>obj)[prop];
                }
            }
        }

        if (result.childNodes && result.childNodes.length) {
            result.childNodes = this._makeReference(result.childNodes);
        }

        return result;
    }
}
