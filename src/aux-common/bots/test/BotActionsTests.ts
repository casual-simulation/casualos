import {
    action,
    botAdded,
    botRemoved,
    botUpdated,
    superShout,
    toast,
    tweenTo,
    openQRCodeScanner,
    showQRCode,
    loadSimulation as loadUniverse,
    unloadSimulation as unloadUniverse,
    importAUX,
    showInputForTag,
    goToDimension,
    goToURL,
    openURL,
    shell,
    openConsole,
    backupToGithub,
    backupAsDownload,
    openBarcodeScanner,
    showBarcode,
    checkout,
    finishCheckout,
    webhook,
    reject,
    html,
    loadFile,
    saveFile,
    replaceDragBot,
    setupUniverse,
    hideHtml,
    ReplaceDragBotAction,
    setClipboard,
    showChat,
    hideChat,
    runScript,
    download,
    showUploadAuxFile,
    markHistory,
    browseHistory,
    restoreHistoryMark,
    RestoreHistoryMarkAction,
    enableAR,
    enableVR,
    disableVR,
    disableAR,
    showJoinCode,
    requestFullscreen,
    exitFullscreen,
    RejectAction,
    addState,
    ShoutAction,
} from '../BotEvents';
import {
    createBot,
    getActiveObjects,
    isBot,
    hasValue,
    ORIGINAL_OBJECT,
} from '../BotCalculations';
import { getBotsForAction, ActionResult } from '../BotsChannel';
import {
    calculateDestroyBotEvents,
    resolveRejectedActions,
} from '../BotActions';
import { BotsState, DEVICE_BOT_ID, Bot, KNOWN_PORTALS } from '../Bot';
import {
    createCalculationContext,
    createFormulaLibrary,
} from '../BotCalculationContextFactories';
import { SandboxFactory, SandboxLibrary } from '../../Formulas/Sandbox';
import { remote } from '@casual-simulation/causal-trees';
import { types } from 'util';
import {
    numericalTagValueTests,
    possibleTagValueCases,
} from './BotTestHelpers';

export function botActionsTests() {
    describe('calculateDestroyBotEvents()', () => {
        it('should return a list of events needed to destroy the given bot', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                auxCreator: 'bot1',
            });
            const bot3 = createBot('bot3', {
                auxCreator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                auxCreator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                botRemoved('bot2'),
                botRemoved('bot3'),
                botRemoved('bot4'),
            ]);
        });

        it('should not return a destroy event for bots that are not destroyable', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                auxCreator: 'bot1',
                auxDestroyable: false,
            });
            const bot3 = createBot('bot3', {
                auxCreator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                auxCreator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                // bot2 and bot3 are not destroyed because they are not destroyable
                botRemoved('bot4'),
            ]);
        });
    });

    describe('getBotsForAction()', () => {
        it('should return the list of bots sorted by ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action('test', ['thisBot', 'thatBot']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([state['thatBot'], state['thisBot']]);
        });

        it('should not sort IDs if the action specifies not to', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action(
                'test',
                ['thisBot', 'thatBot'],
                undefined,
                undefined,
                false
            );
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([state['thisBot'], state['thatBot']]);
        });

        it('should filter out bots which are not in the state', () => {
            const state: BotsState = {};

            const botAction = action('test', ['badBot']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([]);
        });
    });

    describe('resolveRejectedActions()', () => {
        it('should remove an action if it has been rejected after it was issued', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, reject(toastAction)];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([]);
        });

        it('should keep an action if it has been rejected before it was issued', () => {
            let toastAction = toast('abc');
            let actions = [reject(toastAction), toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc')]);
        });

        it('should be able to remove a rejection', () => {
            let toastAction = toast('abc');
            let rejection = reject(toastAction);
            let actions = [toastAction, rejection, reject(rejection)];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc')]);
        });

        it('should preserve the order of the original actions', () => {
            let actions = [toast('abc'), toast('def')];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc'), toast('def')]);
        });

        it('should handle rejecting an action twice', () => {
            let toastAction = toast('abc');
            let actions = [
                toastAction,
                reject(toastAction),
                reject(toastAction),
            ];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([]);
        });

        it('should remove duplicate actions', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toastAction]);
        });

        it('should allow an action if it is re-added after it is rejected', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, reject(toastAction), toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toastAction]);
        });
    });
}
