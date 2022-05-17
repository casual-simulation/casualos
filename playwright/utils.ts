import { BrowserContext, Page, expect } from '@playwright/test';
import type { BotsState } from '../src/aux-server/node_modules/@casual-simulation/aux-common/bots/Bot.ts';

export interface SimulationState {
    shared?: BotsState;
    tempLocal?: BotsState;
}

export interface TestOptions {
    gridPortal?: string;
    gridPortalSelector?: string;
}

export async function setBotState(
    context: BrowserContext,
    state: SimulationState
) {
    await context.exposeFunction('getInitialBotState', () => {
        console.log('Call function');
        return state;
    });
}

export async function expectRenderedState(
    context: BrowserContext,
    page: Page,
    state: SimulationState,
    options: TestOptions = {}
) {
    await setBotState(context, state);
    await page.goto(
        `playwright.html?inst=my-inst&gridPortal=${
            options.gridPortal ?? 'home'
        }`
    );
    const gridPortal = page.locator(
        options.gridPortalSelector ?? '.game-container .game-canvas'
    );
    await expect(gridPortal).toHaveScreenshot();
}
