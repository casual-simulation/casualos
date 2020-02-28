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
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager } from '../../shared/AppManager';
import { first } from 'rxjs/operators';
import { Dictionary } from 'vue-router/types/router';
import {
    BrowserSimulation,
    userBotChanged,
    getUserBotAsync,
    userBotTagsChanged,
} from '@casual-simulation/aux-vm-browser';
import { UpdatedBotInfo } from '@casual-simulation/aux-vm';
import intersection from 'lodash/intersection';
import { Subscription } from 'rxjs';
import isEqual from 'lodash/isEqual';

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class PlayerHome extends Vue {
    @Prop() query: Dictionary<string[] | string>;

    debug: boolean = false;
    isLoading: boolean = false;

    private _simulations: Map<BrowserSimulation, Subscription>;

    get user() {
        return appManager.user;
    }

    get botManager() {
        return appManager.simulationManager.primary;
    }

    @Watch('query')
    async onQueryChanged() {
        await this._setUniverse(this.query['auxUniverse'] as (
            | string
            | string[]));
        for (let [sim, sub] of this._simulations) {
            getUserBotAsync(sim).subscribe(
                bot => {
                    this._updatePlayerTags(sim, bot);
                },
                err => console.error(err)
            );
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        this._simulations = new Map();

        appManager.simulationManager.simulationAdded.subscribe(sim => {
            const sub = this._setupSimulation(sim);
            this._simulations.set(sim, sub);
        });

        appManager.simulationManager.simulationRemoved.subscribe(sim => {
            let sub = this._simulations.get(sim);
            if (sub) {
                sub.unsubscribe();
            }
        });

        if (this.query) {
            this._setUniverse(this.query['auxUniverse'] as (string | string[]));
        }
    }

    private _setupSimulation(sim: BrowserSimulation): Subscription {
        let setInitialValues = false;
        return userBotTagsChanged(sim).subscribe(
            update => {
                if (!setInitialValues) {
                    setInitialValues = true;
                    this._updatePlayerTags(sim, update.bot);
                } else {
                    if (sim.id === appManager.simulationManager.primary.id) {
                        this._handleQueryUpdates(sim, update);
                        if (update.tags.has('auxUniverse')) {
                            // Universe changed - update it
                            const calc = sim.helper.createContext();
                            const universe = calculateStringListTagValue(
                                calc,
                                update.bot,
                                'auxUniverse',
                                null
                            );
                            if (hasValue(universe)) {
                                this._setUniverse(universe);
                            }
                        }
                    }
                }

                this._sendPortalChangedEvents(sim, update);
            },
            err => console.log(err)
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

    private async _setUniverse(newUniverse: string | string[]) {
        if (typeof newUniverse === 'string') {
            await this._loadPrimarySimulation(newUniverse);
        } else {
            if (!appManager.simulationManager.primary) {
                await this._loadPrimarySimulation(newUniverse[0]);
            }
            await appManager.simulationManager.updateSimulations(newUniverse);
        }
    }

    private async _loadPrimarySimulation(newUniverse: string) {
        const sim = await appManager.setPrimarySimulation(newUniverse);
        sim.connection.syncStateChanged
            .pipe(first(synced => synced))
            .subscribe(() => {
                this.isLoading = false;
            });
    }

    private async _updatePlayerTags(
        botManager: BrowserSimulation,
        bot: PrecalculatedBot
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
        let hasChange = false;
        for (let tag of tags) {
            const oldValue = this.query[tag];
            const newValue = calculateBotValue(calc, update.bot, tag);
            if (!isEqual(newValue, oldValue)) {
                changes[tag] = newValue;
                hasChange = true;
            }
        }

        if (hasChange) {
            const final = {
                ...this.$route,
                query: {
                    ...this.query,
                    ...changes,
                },
            };

            window.history.pushState({}, window.document.title);
            this.$router.replace(final);
        }
    }

    async mounted() {
        // this._updateChannels(this.channels);
    }

    // private async _updateChannels(newChannels: string | string[]) {
    //     newChannels = newChannels || [];

    //     if (!Array.isArray(newChannels)) {
    //         newChannels = [newChannels];
    //     }

    //     for (let i = 0; i < newChannels.length; i++) {
    //         await appManager.simulationManager.primary.helper.createSimulation(
    //             newChannels[i]
    //         );
    //     }
    // }
}
