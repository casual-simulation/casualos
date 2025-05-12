
import { EditorAction, registerEditorAction } from 'monaco-editor/esm/vs/editor/browser/editorExtensions';
import { EditorContextKeys } from 'monaco-editor/esm/vs/editor/common/editorContextKeys';
import { KeyCode, KeyMod } from '../KeyCodes';
import { onFocusSearch } from '../../../vue-components/SystemPortal/SystemPortalHelpers';

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