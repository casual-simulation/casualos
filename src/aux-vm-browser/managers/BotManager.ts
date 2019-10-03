import {
    Bot,
    UserMode,
    isDiff,
    merge,
    parseSimulationId,
} from '@casual-simulation/aux-common';

import {
    AuxUser,
    AuxVM,
    BaseSimulation,
    LoginManager,
    getTreeName,
} from '@casual-simulation/aux-vm';
import SelectionManager from './SelectionManager';
import { RecentBotManager } from './RecentBotManager';
import { BotPanelManager } from './BotPanelManager';
import { BrowserSimulation } from './BrowserSimulation';
import { AuxVMImpl } from '../vm/AuxVMImpl';
import { ProgressManager } from '@casual-simulation/aux-vm/managers';
import { filter } from 'rxjs/operators';
import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { AuxPartitionConfig } from '@casual-simulation/aux-vm/partitions';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit bots.
 */
export class BotManager extends BaseSimulation implements BrowserSimulation {
    private _selection: SelectionManager;
    private _recent: RecentBotManager;
    private _botPanel: BotPanelManager;
    private _login: LoginManager;
    private _progress: ProgressManager;

    /**
     * Gets all the selected bots that represent an object.
     */
    get selectedObjects(): Bot[] {
        return this.selection.getSelectedBotsForUser(this.helper.userBot);
    }

    /**
     * Gets the selection manager.
     */
    get selection() {
        return this._selection;
    }

    /**
     * Gets the recent bots manager.
     */
    get recent() {
        return this._recent;
    }

    /**
     * Gets the bots panel manager.
     */
    get botPanel() {
        return this._botPanel;
    }

    get login() {
        return this._login;
    }

    get progress() {
        return this._progress;
    }

    get consoleMessages() {
        return <Observable<ConsoleMessages>>(
            this._vm.connectionStateChanged.pipe(
                filter(
                    m =>
                        m.type === 'log' ||
                        m.type === 'error' ||
                        m.type === 'warn'
                )
            )
        );
    }

    constructor(
        user: AuxUser,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        super(
            id,
            config,
            createPartitions(),
            config => new AuxVMImpl(user, config)
        );
        this.helper.userId = user ? user.id : null;

        this._selection = new SelectionManager(this._helper);
        this._recent = new RecentBotManager(this._helper);
        this._login = new LoginManager(this._vm);
        this._progress = new ProgressManager(this._vm);

        function createPartitions(): AuxPartitionConfig {
            const parsedId = parseSimulationId(id);
            return {
                '*': {
                    type: 'remote_causal_tree',
                    id: id,
                    host: parsedId.host,
                    treeName: getTreeName(parsedId.channel),
                },
                device: {
                    type: 'memory',
                    initialState: {},
                },
            };
        }
    }

    /**
     * Sets the bot mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode) {
        return this.helper.updateBot(this.helper.userBot, {
            tags: {
                'aux._mode': mode,
            },
        });
    }

    async editBot(bot: Bot, tag: string, value: any): Promise<void> {
        const val = this.helper.botsState[bot.id].tags[tag];
        if (val === value) {
            return;
        }
        if (!isDiff(null, bot) && bot.id !== 'empty') {
            await this.recent.addTagDiff(`mod-${bot.id}_${tag}`, tag, value);
            await this.helper.updateBot(bot, {
                tags: {
                    [tag]: value,
                },
            });
        } else {
            const updated = merge(bot, {
                tags: {
                    [tag]: value,
                },
                values: {
                    [tag]: value,
                },
            });
            await this.recent.addBotDiff(updated, true);
        }
    }

    protected _initManagers() {
        super._initManagers();
        this._botPanel = new BotPanelManager(
            this._watcher,
            this._helper,
            this._selection,
            this._recent
        );
    }
}
