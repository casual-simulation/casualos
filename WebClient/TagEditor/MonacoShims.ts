import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { SimpleEditorModelResolverService } from 'monaco-editor/esm/vs/editor/standalone/browser/simpleServices';
import { find } from 'lodash';
/**
 * Monkeypatch to make 'Find All References' work across multiple files
 * https://github.com/Microsoft/monaco-editor/issues/779#issuecomment-374258435
 */
SimpleEditorModelResolverService.prototype.findModel = function(editor: monaco.editor.ICodeEditor, resource: monaco.Uri) {
  return find(monaco.editor.getModels(), model => model.uri.toString() === resource.toString());
};