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
import {
    asyncError,
    asyncResult,
    hasValue,
    ON_DOCUMENT_AVAILABLE_ACTION_NAME,
    action,
} from '@casual-simulation/aux-common';
import type { AuxHelper } from '../vm';
import { HtmlAppBackend, isBrowserDocument } from './HtmlAppBackend';
import type { AppBackend } from './AppBackend';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

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

    handleEvents(events: RuntimeActions[]): void {
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
                    if (!isBrowserDocument()) {
                        // document is not defined so we should make a root custom app
                        console.log(
                            '[CustomAppHelper] Creating root custom app'
                        );

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
                    } else {
                        // document is defined
                        this.helper.transaction(
                            action(
                                ON_DOCUMENT_AVAILABLE_ACTION_NAME,
                                null,
                                this.helper.userId
                            )
                        );
                    }
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
