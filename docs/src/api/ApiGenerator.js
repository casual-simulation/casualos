import { Project, ts } from 'ts-morph';
import apiText from 'raw-loader!@casual-simulation/aux-common/runtime/AuxLibraryDefinitions.def';

const project = new Project({});
const source = project.createSourceFile('api.d.ts', apiText);

export {
    source
};

export function getInterfaceText(i) {
    let text = '';
    for (let comment of i.getLeadingCommentRanges()) {
        text += comment.getText();
        text += '\n';
    }

    text += i.getText(source);
    text += '\n';
    return text;
}