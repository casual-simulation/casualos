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
import { uniqueNamesGenerator, Config } from 'unique-names-generator';
import adjectives from '../../shared/dictionaries/adjectives';
import colors from '../../shared/dictionaries/colors';
import animals from '../../shared/dictionaries/animals';

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
        const story = this.query['story'] as (string | string[]);
        await this._setStory(story);
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
            // On first load check the story and load a default
            let story = this.query['story'] as (string | string[]);
            if (!hasValue(story)) {
                // Generate a random story name
                const randomName: string = uniqueNamesGenerator(namesConfig);
                let update: Dictionary<string> = {
                    story: randomName,
                };
                if (!hasValue(this.query['pagePortal'])) {
                    update.pagePortal = 'home';
                }
                this._updateQuery(update);
                story = randomName;
            }
            this._setStory(story);
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
                        if (update.tags.has('story')) {
                            // Story changed - update it
                            const calc = sim.helper.createContext();
                            const story = calculateStringListTagValue(
                                calc,
                                update.bot,
                                'story',
                                null
                            );
                            if (hasValue(story)) {
                                this._setStory(story);
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

    private async _setStory(newStory: string | string[]) {
        if (typeof newStory === 'string') {
            await this._loadPrimarySimulation(newStory);
        } else {
            if (!appManager.simulationManager.primary) {
                await this._loadPrimarySimulation(newStory[0]);
            }
            await appManager.simulationManager.updateSimulations(newStory);
        }
    }

    private async _loadPrimarySimulation(newStory: string) {
        const sim = await appManager.setPrimarySimulation(newStory);
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
