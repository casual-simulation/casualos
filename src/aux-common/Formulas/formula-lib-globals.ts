import { FilesState } from '../Files/File';
import { BotAction } from '../Files/FileEvents';
import { BotSandboxContext } from '../Files/FileCalculationContext';

let actions: BotAction[] = [];
let state: FilesState = null;
let calc: BotSandboxContext = null;
let currentEnergy: number = 0;

export function setActions(value: BotAction[]) {
    actions = value;
}

export function getActions(): BotAction[] {
    return actions;
}

export function addAction(event: BotAction) {
    let actions = getActions();
    actions.push(event);
    return event;
}

export function setFileState(value: FilesState) {
    state = value;
}

export function getFileState(): FilesState {
    return state;
}

export function setCalculationContext(context: BotSandboxContext) {
    calc = context;
}

export function getCalculationContext(): BotSandboxContext {
    return calc;
}

export function getUserId(): string {
    if (calc) {
        return calc.sandbox.interface.userId();
    } else {
        return null;
    }
}

export function getEnergy(): number {
    return currentEnergy;
}

export function setEnergy(energy: number) {
    currentEnergy = energy;
}
