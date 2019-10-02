import { BotsState } from '../bots/Bot';
import { BotAction } from '../bots/BotEvents';
import { BotSandboxContext } from '../bots/BotCalculationContext';

let actions: BotAction[] = [];
let state: BotsState = null;
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

export function setBotState(value: BotsState) {
    state = value;
}

export function getBotState(): BotsState {
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
