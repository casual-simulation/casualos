import { FilesState } from '../Files/File';
import { FileEvent } from '../Files/FileEvents';
import { FileSandboxContext } from '../Files/FileCalculationContext';

let actions: FileEvent[] = [];
let state: FilesState = null;
let calc: FileSandboxContext = null;

export function setActions(value: FileEvent[]) {
    actions = value;
}

export function getActions(): FileEvent[] {
    return actions;
}

export function setFileState(value: FilesState) {
    state = value;
}

export function getFileState(): FilesState {
    return state;
}

export function setCalculationContext(context: FileSandboxContext) {
    calc = context;
}

export function getCalculationContext(): FileSandboxContext {
    return calc;
}

export function getUserId(): string {
    if (calc) {
        return calc.sandbox.interface.userId();
    } else {
        return null;
    }
}
