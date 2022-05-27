import { BrowserContext, Page, expect, Locator } from '@playwright/test';
import type { BotsState } from '../src/aux-server/node_modules/@casual-simulation/aux-common/bots/Bot.ts';

import { v4 as uuid } from 'uuid';

export interface SimulationState {
    shared?: BotsState;
    tempLocal?: BotsState;
}

export interface TestOptions {
    gridPortal?: string;
    gridPortalSelector?: string;
    maxDiffPixels?: number;
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

export async function openRandomInst(
    context: BrowserContext,
    page: Page,
    options: TestOptions
) {
    const renderPromise = waitForFirstRender(context);
    await page.goto(
        `playwright.html?inst=${uuid()}&gridPortal=${
            options.gridPortal ?? 'home'
        }`
    );
    await renderPromise;
}

export function getGridPortal(page: Page, options: TestOptions) {
    return page.locator(
        options.gridPortalSelector ?? '.game-container .game-canvas canvas'
    );
}

export async function expectGridPortalScreenshot(
    page: Page,
    options: TestOptions
) {
    const gridPortal = getGridPortal(page, options);
    await expect(gridPortal).toHaveScreenshot({
        maxDiffPixels: options.maxDiffPixels ?? 100,
    });
}

export async function expectRenderedState(
    context: BrowserContext,
    page: Page,
    state: SimulationState,
    options: TestOptions = {}
) {
    await setBotState(context, state);
    await openRandomInst(context, page, options);
    await expectGridPortalScreenshot(page, options);
}

export async function expectGridPortalInteraction(
    context: BrowserContext,
    page: Page,
    state: SimulationState,
    action: (page: Page, gridPortal: Locator) => Promise<void>,
    options: TestOptions = {}
) {
    await setBotState(context, state);
    await openRandomInst(context, page, options);
    const gridPortal = getGridPortal(page, options);
    await expectGridPortalScreenshot(page, options);
    await action(page, gridPortal);
    await expectGridPortalScreenshot(page, options);
}

export function screenPosition(
    boundingBox: BoundingBox,
    x: number,
    y: number
): Position {
    return {
        x: boundingBox.width * x,
        y: boundingBox.height * y,
    };
}

export async function setInputDebugLevel(page: Page, level: number) {
    return await page.evaluate((level) => {
        let game = (window as any).aux.getGame();
        game.input.debugLevel = level;
    }, level);
}

export async function mouseDragAndDrop(
    page: Page,
    ...positions: Position[]
): Promise<void> {
    for (let i = 0; i < positions.length; i++) {
        let pos = positions[i];
        await waitForNextFrame(page);
        await page.mouse.move(pos.x, pos.y, { steps: 5 });

        if (i === 0) {
            await page.mouse.down({ button: 'left' });
        } else if (i === positions.length - 1) {
            await page.mouse.up({ button: 'left' });
        }
    }
}

export async function waitForNextFrame(page: Page) {
    const frameCount = await getFrameCount(page);
    await page.waitForFunction(
        (count) => {
            let game = (window as any).aux.getGame();
            return game.time.frameCount >= count;
        },
        frameCount,
        { polling: 'raf' }
    );
}

export async function getFrameCount(page: Page): Promise<number> {
    return await page.evaluate(() => {
        let game = (window as any).aux.getGame();
        return game.time.frameCount;
    });
}

export async function getScreenPositionForPoint(
    page: Page,
    boundingBox: BoundingBox,
    point: Position3D
): Promise<Position> {
    const position = await page.evaluate(({ x, y, z }) => {
        let game = (window as any).aux.getGame();
        const three = (window as any).aux.getThree();
        let rig = game.getMainCameraRig();
        let vector = new three.Vector3(x, y, z);
        vector.project(rig.mainCamera);

        return {
            x: vector.x,
            y: vector.y,
        };
    }, point);

    return screenPosition(
        boundingBox,
        (position.x + 1) / 2,
        -(position.y - 1) / 2
    );
}

export async function getScreenPositionForBot(
    page: Page,
    boundingBox: BoundingBox,
    botId: string
): Promise<Position> {
    const botPosition = await getBotPosition(page, botId);
    return await getScreenPositionForPoint(page, boundingBox, botPosition);
}

export async function getBotPosition(
    page: Page,
    botId: string
): Promise<Position3D> {
    const position = await page.evaluate((botId) => {
        let game = (window as any).aux.getGame();
        let three = (window as any).aux.getThree();
        const bots = game.findAllBotsById(botId);

        if (bots.length > 0) {
            let vector = new three.Vector3();
            let position = bots[0].display.getWorldPosition(vector);
            return {
                x: position.x,
                y: position.y,
                z: position.z,
            };
        } else {
            return null;
        }
    }, botId);

    return position;
}

export interface BoundingBox {
    width: number;
    height: number;
}

export interface Position {
    x: number;
    y: number;
}

export interface Position3D {
    x: number;
    y: number;
    z: number;
}
