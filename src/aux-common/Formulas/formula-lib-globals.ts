import { BotsState, ScriptBot } from '../bots/Bot';
import { BotAction } from '../bots/BotEvents';
import { BotSandboxContext } from '../bots/BotCalculationContext';

let actions: BotAction[] = [];
let calc: BotSandboxContext = null;
let currentBot: ScriptBot = null;
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

export function getBotState(): BotsState {
    return calc ? calc.sandbox.interface.state : null;
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

export function getCurrentBot() {
    return currentBot;
}

export function setCurrentBot(bot: ScriptBot) {
    currentBot = bot;
}
