import { BrowserContext, Page, expect } from '@playwright/test';
import type { BotsState } from '../src/aux-server/node_modules/@casual-simulation/aux-common/bots/Bot.ts';
import { v4 as uuid } from 'uuid';

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
    await context.exposeFunction('_getInitialBotStateHook', () => {
        return state;
    });
}

export async function waitForFirstRender(
    context: BrowserContext
): Promise<void> {
    let resolve: any;
    let promise = new Promise<void>((r, reject) => {
        resolve = r;
    });

    await context.exposeFunction('_firstRenderHook', () => {
        resolve();
    });
    await promise;
}

export async function expectRenderedState(
    context: BrowserContext,
    page: Page,
    state: SimulationState,
    options: TestOptions = {}
) {
    await setBotState(context, state);
    const renderPromise = waitForFirstRender(context);
    await page.goto(
        `playwright.html?inst=${uuid()}&gridPortal=${
            options.gridPortal ?? 'home'
        }`
    );
    await renderPromise;
    const gridPortal = page.locator(
        options.gridPortalSelector ?? '.game-container .game-canvas canvas'
    );
    await expect(gridPortal).toHaveScreenshot();
}
