/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Registry } from 'monaco-editor/esm/vs/platform/registry/common/platform';
import { Extensions } from 'monaco-editor/esm/vs/platform/quickinput/common/quickAccess';
import { EditorAction, registerEditorAction } from 'monaco-editor/esm/vs/editor/browser/editorExtensions';
import { EditorContextKeys } from 'monaco-editor/esm/vs/editor/common/editorContextKeys';
import { IQuickInputService } from 'monaco-editor/esm/vs/platform/quickinput/common/quickInput';
import { appManager } from '../../../../shared/AppManager';
import { calculateBotValue, hasValue, SHEET_PORTAL, SYSTEM_PORTAL, tagsOnBot, tweenTo } from '@casual-simulation/aux-common';
import { KeyCode, KeyMod } from '../KeyCodes';
interface IDisposable {
    dispose(): void;
}

class GoToTagQuickAccessProvider {
    static readonly PREFIX = '#';

    provide(picker: any, token: any): IDisposable {
        const sim = appManager.simulationManager.primary;
        const disposables = [] as IDisposable[];

        const userBot = sim.helper.userBot;
        const isInSheet = hasValue(calculateBotValue(null, userBot, SHEET_PORTAL));

        if (isInSheet) {
            picker.items = sim.botPanel.state.bots.flatMap(b => {
                const tags = tagsOnBot(b);
                return tags.map(t => ({
                    label: t,
                    description: b.id,
                    botId: b.id,
                    tag: t,
                    simulationId: sim.id
                }));
            });
        } else {
            const items = appManager.systemPortal.items;
            if (items.hasPortal) {
                picker.items =  items.items.flatMap(i => {
                    return i.areas.flatMap(a => {
                        return a.bots.flatMap(b => {
                            const tags = tagsOnBot(b.bot);
                            return tags.map(t => ({
                                label: t,
                                description: b.system,
                                botId: b.bot.id,
                                tag: t,
                                simulationId: i.simulationId
                            }));
                        })
                    });
                });
            }
        }

        disposables.push(picker.onDidAccept((event: any) => {
            const [item] = picker.selectedItems;
            if (item && item.botId && item.tag) {
                const sim = appManager.simulationManager.simulations.get(item.simulationId);
                const userBot = sim.helper.userBot;

                const isInSheet = hasValue(calculateBotValue(null, userBot, SHEET_PORTAL));
                const isInSystemPortal = hasValue(calculateBotValue(null, userBot, SYSTEM_PORTAL));

                let portal = 'sheetPortal';
                if (!isInSheet && isInSystemPortal) {
                    portal = 'systemPortal';
                }

                sim.helper.transaction(
                    tweenTo(item.botId, {
                        tag: item.tag,
                        portal
                    })
                )
            }
        }));

        return {
            dispose() { 
                for(let d of disposables) {
                    d.dispose();
                }
            }
        };
    }
}

Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
    ctor: GoToTagQuickAccessProvider,
    prefix: GoToTagQuickAccessProvider.PREFIX,
    helpEntries: []
});

export class GotoTagAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.quickOutline2',
            label: 'Go to tag...',
            alias: 'Go to tag...',
            // precondition: EditorContextKeys.hasDocumentSymbolProvider,
            kbOpts: {
                kbExpr: EditorContextKeys.focus,
                primary: KeyMod.CtrlCmd | KeyCode.KEY_P
            },
            contextMenuOpts: {
                group: 'navigation',
                order: 3
            }
        });
    }
    run(accessor: any) {
        accessor.get(IQuickInputService).quickAccess.show(GoToTagQuickAccessProvider.PREFIX);
    }
}
registerEditorAction(GotoTagAction);