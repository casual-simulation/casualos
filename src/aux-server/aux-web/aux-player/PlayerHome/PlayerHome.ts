import Vue from 'vue';
import Component from 'vue-class-component';
import { Watch, Prop } from 'vue-property-decorator';
import {
    goToDimension,
    calculateBotValue,
    BotTags,
    PrecalculatedBot,
    hasValue,
    BotCalculationContext,
    QUERY_PORTALS,
    KNOWN_PORTALS,
    BotAction,
    ON_PLAYER_PORTAL_CHANGED_ACTION_NAME,
    calculateStringTagValue,
    calculateStringListTagValue,
    ON_PORTAL_CHANGED_ACTION_NAME,
    QUERY_FULL_HISTORY_TAGS,
    QUERY_PARTIAL_HISTORY_TAGS,
    getBotTheme,
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager, getSimulationId } from '../../shared/AppManager';
import { first } from 'rxjs/operators';
import { Dictionary } from 'vue-router/types/router';
import {
    BrowserSimulation,
    userBotChanged,
    getUserBotAsync,
    userBotTagsChanged,
} from '@casual-simulation/aux-vm-browser';
import { UpdatedBotInfo } from '@casual-simulation/aux-vm';
import { intersection, isEqual } from 'lodash';
import { Subscription } from 'rxjs';
import { uniqueNamesGenerator, Config } from 'unique-names-generator';
import adjectives from '../../shared/dictionaries/adjectives';
import colors from '../../shared/dictionaries/colors';
import animals from '../../shared/dictionaries/animals';
import { setTheme } from '../../shared/StyleHelpers';

const namesConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
};

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class PlayerHome extends Vue {
    @Prop() query: Dictionary<string[] | string>;
    @Prop() url: string;

    debug: boolean = false;
    isLoading: boolean = false;

    private _simulations: Map<BrowserSimulation, Subscription>;

    get botManager() {
        return appManager.simulationManager.primary;
    }

    @Watch('query')
    async onQueryChanged(newValue: any, oldQuery: any) {
        const inst = this.query['inst'] as string | string[];
        let recordName = this.query['record'] ?? this.query['player'] ?? null;
        if (hasValue(inst)) {
            await this._setServer(recordName, inst);
        }
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe(
                (bot) => {
                    this._updatePlayerTags(sim, bot, Object.keys(oldQuery));
                },
                (err) => console.error(err)
            );
        }
    }

    @Watch('url')
    async onUrlChanged() {
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe(
                (bot) => {
                    this._updateUrlTag(sim, bot);
                },
                (err) => console.error(err)
            );
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        this._simulations = new Map();

        appManager.simulationManager.simulationAdded.subscribe((sim) => {
            const sub = this._setupSimulation(sim);
            this._simulations.set(sim, sub);
        });

        appManager.simulationManager.simulationRemoved.subscribe((sim) => {
            let sub = this._simulations.get(sim);
            if (sub) {
                sub.unsubscribe();
            }
        });

        if (this.query) {
            let update: Dictionary<string | string[]> = {};
            let recordName = this.query['record'] ?? null;
            let inst = this.query['inst'] as string | string[];
            const preferPublic =
                (appManager.config.preferredInstSource ?? 'private') ===
                'public';

            const hasQueryParam = Object.keys(this.query).length > 0;

            if (hasValue(recordName)) {
                update.record = recordName;
            } else {
                let player = this.query['player'] ?? null;
                if (player) {
                    update.player = player;
                    recordName = player;
                } else if (
                    !preferPublic &&
                    appManager.defaultPlayerId &&
                    !hasQueryParam
                ) {
                    // Only use the default player if there are no other query params.
                    // This prevents bad actors from giving the user a URL that auto-populates data into a private inst.
                    update.player = appManager.defaultPlayerId;
                    recordName = appManager.defaultPlayerId;
                } else if (preferPublic) {
                    recordName = null;
                }
            }

            // On first load check the inst and load a default
            if (!hasValue(inst)) {
                // if there is no inst tag defined, check for the story tag and then the server tag
                inst = this.query['story'] ?? this.query['server'];
                if (hasValue(inst)) {
                    update.inst = inst;
                    update.story = null;
                    update.server = null;
                } else {
                    // Generate a random inst name
                    const randomName: string =
                        uniqueNamesGenerator(namesConfig);
                    if (!appManager.config.disableCollaboration) {
                        update.inst = randomName;
                    }
                    if (!hasValue(this.query['gridPortal'])) {
                        update.gridPortal = 'home';
                    }
                    inst = randomName;
                }
            }

            if (
                hasValue(this.query['pagePortal']) &&
                !hasValue(this.query['gridPortal'])
            ) {
                const portal = this.query['pagePortal'];
                update.pagePortal = null;
                update.gridPortal = Array.isArray(portal) ? portal[0] : portal;
            }

            if (Object.keys(update).length > 0) {
                this._updateQuery(update);
            }
            this._setServer(recordName, inst);
        }
    }

    private _setupSimulation(sim: BrowserSimulation): Subscription {
        let setInitialValues = false;
        return userBotTagsChanged(sim).subscribe(
            (update) => {
                if (!setInitialValues) {
                    setInitialValues = true;
                    this._updatePlayerTags(sim, update.bot);
                } else {
                    if (sim.id === appManager.simulationManager.primary.id) {
                        this._handleQueryUpdates(sim, update);
                        if (
                            update.tags.has('inst') &&
                            !appManager.config.disableCollaboration
                        ) {
                            // inst changed - update it
                            const calc = sim.helper.createContext();
                            const inst = calculateStringListTagValue(
                                calc,
                                update.bot,
                                'inst',
                                null
                            );
                            const recordName =
                                calculateStringTagValue(
                                    calc,
                                    update.bot,
                                    'record',
                                    null
                                ) ??
                                calculateStringTagValue(
                                    calc,
                                    update.bot,
                                    'player',
                                    null
                                );
                            if (hasValue(inst)) {
                                this._setServer(recordName, inst);
                            }
                        }

                        if (update.tags.has('pageTitle')) {
                            // Title changed - update it
                            const title = calculateStringTagValue(
                                null,
                                update.bot,
                                'pageTitle',
                                'CasualOS'
                            );
                            document.title = title;
                        }

                        if (update.tags.has('theme')) {
                            const theme = getBotTheme(null, update.bot);
                            setTheme(theme);
                        }
                    }
                }

                this._sendPortalChangedEvents(sim, update);
            },
            (err) => console.log(err)
        );
    }

    private async _sendPortalChangedEvents(
        sim: BrowserSimulation,
        update: UpdatedBotInfo
    ) {
        const actions: BotAction[] = [];
        const calc = sim.helper.createContext();
        for (let portal of KNOWN_PORTALS) {
            if (update.tags.has(portal)) {
                const value = calculateBotValue(calc, update.bot, portal);
                actions.push(
                    ...sim.helper.actions([
                        {
                            bots: null,
                            eventName: ON_PORTAL_CHANGED_ACTION_NAME,
                            arg: {
                                portal: portal,
                                dimension: value,
                            },
                        },
                        {
                            bots: null,
                            eventName: ON_PLAYER_PORTAL_CHANGED_ACTION_NAME,
                            arg: {
                                portal: portal,
                                dimension: value,
                            },
                        },
                    ])
                );
            }
        }

        if (actions.length > 0) {
            await sim.helper.transaction(...actions);
        }
    }

    private async _setServer(
        recordName: string | string[],
        newServer: string | string[]
    ) {
        const record = getFirst(recordName);
        if (typeof newServer === 'string') {
            await this._loadPrimarySimulation(record, newServer);
        } else {
            if (!appManager.simulationManager.primary) {
                await this._loadPrimarySimulation(record, newServer[0]);
            }
            await appManager.simulationManager.updateSimulations(
                newServer.map((s) => ({
                    id: getSimulationId(record, s),
                    options: {
                        recordName: record,
                        inst: s,
                    },
                }))
            );
        }
    }

    private async _loadPrimarySimulation(
        recordName: string,
        newServer: string
    ) {
        const sim = await appManager.setPrimarySimulation(
            recordName,
            newServer
        );
        sim.connection.syncStateChanged
            .pipe(first((synced) => synced))
            .subscribe(() => {
                this.isLoading = false;
            });
    }

    private async _updatePlayerTags(
        botManager: BrowserSimulation,
        bot: PrecalculatedBot,
        oldTags?: string[]
    ) {
        const calc = botManager.helper.createContext();
        const tags = Object.keys(this.query);
        let changes: BotTags = {};
        let hasChange = false;
        for (let tag of tags) {
            const oldValue = calculateBotValue(calc, bot, tag);
            const newValue = this.query[tag];
            if (newValue !== oldValue) {
                changes[tag] = newValue;
                hasChange = true;
            }
        }
        if (oldTags) {
            for (let tag of oldTags) {
                if (!tags.includes(tag)) {
                    changes[tag] = null;
                }
            }
        }
        if (bot.tags.url !== location.href) {
            changes.url = location.href;
            hasChange = true;
        }
        if (hasChange) {
            await botManager.helper.updateBot(bot, {
                tags: changes,
            });
        }
    }

    private async _updateUrlTag(
        botManager: BrowserSimulation,
        bot: PrecalculatedBot
    ) {
        let changes: BotTags = {};
        let hasChange = false;
        if (bot.tags.url !== location.href) {
            changes.url = location.href;
            hasChange = true;
        }
        if (hasChange) {
            await botManager.helper.updateBot(bot, {
                tags: changes,
            });
        }
    }

    private _handleQueryUpdates(
        botManager: BrowserSimulation,
        update: UpdatedBotInfo
    ) {
        const calc = botManager.helper.createContext();
        const tags = intersection(
            [...update.tags],

            // Include the known portals so that they always update the URL
            [...Object.keys(this.query), ...QUERY_PORTALS]
        );
        let changes: Dictionary<any> = {};
        for (let tag of tags) {
            const oldValue = this.query[tag];
            const newValue = calculateBotValue(calc, update.bot, tag);
            if (!isEqual(newValue, oldValue)) {
                changes[tag] = newValue;
            }
        }

        this._updateQuery(changes);
    }

    private _updateQuery(changes: Dictionary<any>) {
        if (Object.keys(changes).length > 0) {
            const final = {
                ...this.$route,
                query: {
                    ...this.query,
                    ...changes,
                },
            };

            let pushState = false;
            for (let tag in changes) {
                if (QUERY_FULL_HISTORY_TAGS.has(tag)) {
                    pushState = true;
                    break;
                } else if (QUERY_PARTIAL_HISTORY_TAGS.has(tag)) {
                    const value = changes[tag];
                    const url = new URL(location.href);
                    const hasSearch = url.searchParams.has(tag);
                    pushState =
                        (!hasValue(value) && hasSearch) ||
                        (hasValue(value) && !hasSearch);
                    if (pushState) {
                        break;
                    }
                }
            }

            if (pushState) {
                window.history.pushState({}, window.document.title);
            }
            this.$router.replace(final).then(undefined, (err: Error) => {
                // Ignore navigation duplicated errors
                if (err.name !== 'NavigationDuplicated') {
                    // Throw all other error types
                    throw err;
                }
            });
        }
    }
}

function getFirst(list: string | string[]): string {
    if (Array.isArray(list)) {
        return list[0];
    } else {
        return list;
    }
}
