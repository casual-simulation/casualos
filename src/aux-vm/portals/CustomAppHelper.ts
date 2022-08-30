import {
    asyncError,
    asyncResult,
    AuxRuntime,
    BotAction,
    hasValue,
    registerCustomApp,
    ON_DOCUMENT_AVAILABLE_ACTION_NAME,
    action,
} from '@casual-simulation/aux-common';
import { AuxHelper } from '../vm';
import { HtmlAppBackend } from './HtmlAppBackend';
import { AppBackend } from './AppBackend';

const ROOT_APP_ID = '_root';

/**
 * Defines a class that manages the backend of custom portals.
 */
export class CustomAppHelper {
    helper: AuxHelper;

    // TODO: implement portal backend that is passed all the updated bots and can determine when to call @onRender.
    portals: Map<string, AppBackend> = new Map();

    constructor(helper: AuxHelper) {
        this.helper = helper;
    }

    handleEvents(events: BotAction[]): void {
        for (let event of events) {
            if (event.type === 'register_custom_app') {
                let appId = event.appId;

                if (!this.portals.has(appId)) {
                    const backend: AppBackend = new HtmlAppBackend(
                        appId,
                        event.botId,
                        this.helper,
                        event.taskId
                    );

                    this.portals.set(appId, backend);
                } else {
                    if (hasValue(event.taskId)) {
                        this.helper.transaction(
                            asyncResult(event.taskId, null)
                        );
                    }
                }
            } else if (event.type === 'unregister_custom_app') {
                try {
                    let appId = event.appId;

                    const existing = this.portals.get(appId);
                    if (existing) {
                        existing.dispose();
                    }

                    this.portals.delete(appId);

                    if (hasValue(event.taskId)) {
                        this.helper.transaction(
                            asyncResult(event.taskId, null)
                        );
                    }
                } catch (e) {
                    if (hasValue(event.taskId)) {
                        this.helper.transaction(asyncError(event.taskId, e));
                    }
                }
            } else if (event.type === 'custom_app_container_available') {
                if (!this.portals.has(ROOT_APP_ID)) {
                    const appId = ROOT_APP_ID;
                    const botId = this.helper.userId;
                    const backend = new HtmlAppBackend(
                        appId,
                        botId,
                        this.helper
                    );

                    this.portals.set(appId, backend);
                    backend.onSetup.subscribe(() => {
                        (globalThis as any).document = backend.document;
                        this.helper.transaction(
                            action(
                                ON_DOCUMENT_AVAILABLE_ACTION_NAME,
                                null,
                                this.helper.userId
                            )
                        );
                    });
                }
            }
        }

        for (let portal of this.portals.values()) {
            portal.handleEvents(events);
        }
    }

    dispose() {
        if (this.portals) {
            const rootBackend = this.portals.get(ROOT_APP_ID);
            if (
                rootBackend &&
                rootBackend instanceof HtmlAppBackend &&
                globalThis.document === rootBackend.document
            ) {
                delete (globalThis as any).document;
            }
            for (let [id, backend] of this.portals) {
                backend.dispose();
            }
            this.portals = null;
        }
    }
}
