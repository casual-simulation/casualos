import { BotHelper } from '@casual-simulation/aux-vm';
import {
    getSelectionMode,
    selectionIdForUser,
    updateUserSelection,
    toggleBotSelection,
    filterBotsBySelection,
    SelectionMode,
    newSelectionId,
    botUpdated,
    PrecalculatedBot,
    Bot,
} from '@casual-simulation/aux-common';
import { Subject, Observable } from 'rxjs';
import { BotPanelManager } from './BotPanelManager';

/**
 * Defines a class that is able to manage selections for users.
 */
export default class SelectionManager {
    private static readonly _debug = false;
    private _helper: BotHelper;

    private _userChangedSelection: Subject<void>;

    /**
     * Gets an observable that resolves whenever the user takes an action to change the selection.
     */
    get userChangedSelection(): Observable<void> {
        return this._userChangedSelection;
    }

    /**
     * Creates a new object that is able to manage selections for a user.
     * @param helper The bot helper to use.
     */
    constructor(helper: BotHelper) {
        this._helper = helper;
        this._userChangedSelection = new Subject<void>();
    }

    /**
     * Gets the selection mode that the current user is in.
     */
    get mode() {
        return getSelectionMode(this._helper.userBot);
    }

    /**
     * Selects the given bot for the current user.
     * @param bot The bot to select.
     * @param multiSelect Whether to put the user into multi-select mode. (Default false)
     */
    async selectBot(
        bot: Bot,
        multiSelect: boolean = false,
        botManager: BotPanelManager = null
    ) {
        if (
            multiSelect ||
            this._helper.userBot.tags['_auxSelection'] != bot.id
        ) {
            await this._selectBotForUser(
                bot,
                this._helper.userBot,
                multiSelect
            );
        } else {
            if (botManager != null) {
                botManager.keepSheetsOpen();
            }
        }
    }

    /**
     * Sets the list of bots that the user should have selected.
     * @param bots The bots that should be selected.
     */
    async setSelectedBots(bots: Bot[]) {
        const newId = newSelectionId();

        await this._helper.transaction(
            botUpdated(this._helper.userBot.id, {
                tags: {
                    ['_auxSelection']: newId,
                    ['aux._selectionMode']: 'multi',
                },
            }),
            ...bots.map(f =>
                botUpdated(f.id, {
                    tags: {
                        [newId]: true,
                    },
                })
            )
        );

        this._userChangedSelection.next();
    }

    /**
     * Clears the selection for the current user.
     */
    async clearSelection() {
        await this._clearSelectionForUser(this._helper.userBot);
        this._userChangedSelection.next();
    }

    /**
     * Sets the selection mode for the current user.
     * @param mode The mode.
     */
    async setMode(mode: SelectionMode) {
        const currentMode = getSelectionMode(this._helper.userBot);
        if (currentMode !== mode) {
            return this._helper.updateBot(this._helper.userBot, {
                tags: {
                    'aux._selectionMode': mode,
                },
            });
        }
    }

    /**
     * Gets a list of bots that the given user has selected.
     * @param user The bot of the user.
     */
    getSelectedBotsForUser(user: PrecalculatedBot): PrecalculatedBot[] {
        if (!user) {
            return [];
        }
        return <PrecalculatedBot[]>(
            filterBotsBySelection(
                this._helper.objects,
                user.tags['_auxSelection']
            )
        );
    }

    /**
     * Clears the selection that the given user has.
     * @param user The bot for the user to clear the selection of.
     */
    private async _clearSelectionForUser(user: PrecalculatedBot) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Clear selection for', user.id);
        }
        const update = updateUserSelection(null, null);
        await this._helper.updateBot(user, {
            tags: {
                ...update.tags,
                'aux._selectionMode': 'single',
            },
        });
    }

    private async _selectBotForUser(
        bot: Bot,
        user: PrecalculatedBot,
        multiSelect: boolean
    ) {
        if (SelectionManager._debug) {
            console.log('[SelectionManager] Select Bot:', bot.id);
        }

        const mode = getSelectionMode(user);

        if (mode === 'multi') {
            const { id, newId } = selectionIdForUser(user);
            if (newId) {
                const update = updateUserSelection(newId, bot.id);
                await this._helper.updateBot(user, update);
            }
            if (id) {
                const update = toggleBotSelection(bot, id, user.id);
                await this._helper.updateBot(bot, update);
            }
        } else {
            if (multiSelect) {
                const newId = newSelectionId();
                const current = user.tags['_auxSelection'];
                const update = updateUserSelection(newId, bot.id);
                await this._helper.updateBot(user, {
                    tags: {
                        ...update.tags,
                        ['aux._selectionMode']: 'multi',
                    },
                });

                if (current) {
                    const currentBot = this._helper.botsState[current];
                    if (currentBot) {
                        await this._helper.updateBot(currentBot, {
                            tags: {
                                [newId]: true,
                            },
                        });
                    }
                }

                await this._helper.updateBot(bot, {
                    tags: {
                        [newId]: true,
                    },
                });
            } else {
                const selection = bot.id;

                const update = updateUserSelection(selection, bot.id);
                await this._helper.updateBot(user, update);
                await this._helper.updateBot(bot, { tags: {} });
            }
        }

        this._userChangedSelection.next();
    }
}
