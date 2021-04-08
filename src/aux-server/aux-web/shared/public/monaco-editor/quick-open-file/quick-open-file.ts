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
import { goToTag } from '@casual-simulation/aux-common';
import { KeyCode, KeyMod } from '../KeyCodes';
interface IDisposable {
    dispose(): void;
}

class GoToTagQuickAccessProvider {
    static readonly PREFIX = '#';

    provide(picker: any, token: any): IDisposable {
        const sim = appManager.simulationManager.primary;
        const disposables = [] as IDisposable[];

        picker.items = sim.idePortal.items.items.map(i => ({
            label: i.name,
            description: i.botId,
            botId: i.botId,
            tag: i.tag,
        }));

        disposables.push(picker.onDidAccept((event: any) => {
            const [item] = picker.selectedItems;
            if (item && item.botId && item.tag) {
                sim.helper.transaction(goToTag(item.botId, item.tag));
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

export class GotoLineAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.quickOutline',
            label: 'Go to tag...',
            alias: 'Go to tag...',
            precondition: EditorContextKeys.hasDocumentSymbolProvider,
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
registerEditorAction(GotoLineAction);