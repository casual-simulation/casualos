
import { EditorAction, registerEditorAction } from 'monaco-editor/esm/vs/editor/browser/editorExtensions';
import { EditorContextKeys } from 'monaco-editor/esm/vs/editor/common/editorContextKeys';
import { IQuickInputService } from 'monaco-editor/esm/vs/platform/quickinput/common/quickInput';
import { KeyCode, KeyMod } from '../KeyCodes';
import { onFocusSearch } from '../../../vue-components/IdePortal/IdePortalHelpers';

export class GotoLineAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.searchAll',
            label: 'Search tags...',
            alias: 'Search tags...',
            kbOpts: {
                kbExpr: EditorContextKeys.focus,
                primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_F
            },
            contextMenuOpts: {
                group: 'navigation',
                order: 3
            }
        });
    }
    run(accessor: any) {
        onFocusSearch.next();
    }
}
registerEditorAction(GotoLineAction);