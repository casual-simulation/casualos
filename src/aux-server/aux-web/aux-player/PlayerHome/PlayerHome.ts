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

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class PlayerHome extends Vue {
    @Prop() query: Dictionary<string[] | string>;

    debug: boolean = false;
    isLoading: boolean = false;
    setInitialValues: boolean = false;

    private _sim: BrowserSimulation;

    get user() {
        return appManager.user;
    }

    get botManager() {
        return appManager.simulationManager.primary;
    }

    // @Watch('channels')
    // async onRouteChanged(
    //     newChannels: string | string[],
    //     oldChannels: string | string[]
    // ) {
    //     await this._updateChannels(newChannels);
    // }

    @Watch('query')
    async onQueryChanged() {
        if (this._sim) {
            getUserBotAsync(this._sim).subscribe(
                bot => {
                    this._updatePlayerTags(this._sim, bot);
                },
                err => console.error(err)
            );
        } else {
            await this._setUniverse(this.query['auxUniverse'] as string);
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        this.setInitialValues = false;
        appManager.whileLoggedIn((user, botManager) => {
            this._sim = botManager;
            const sub = userBotTagsChanged(botManager).subscribe(
                update => {
                    if (!this.setInitialValues) {
                        this.setInitialValues = true;
                        this._updatePlayerTags(botManager, update.bot);
                    } else {
                        this._handleQueryUpdates(botManager, update);
                    }

                    // if (update.tags.has('auxUniverse')) {
                    //     // Universe changed - update it
                    //     const calc = botManager.helper.createContext();
                    //     const universe = calculateBotValue(calc, update.bot, 'auxUniverse');
                    //     if (hasValue(universe)) {
                    //         this._setUniverse(universe);
                    //     }
                    // }
                },
                err => console.log(err)
            );

            return [sub];
        });

        if (this.query) {
            this._setUniverse(this.query['auxUniverse'] as string);
        }
    }

    private async _setUniverse(newUniverse: string) {
        this._sim = await appManager.setPrimarySimulation(newUniverse);
        this._sim.connection.syncStateChanged
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
        const tags = intersection([...update.tags], Object.keys(this.query));
        let changes: Dictionary<any> = {};
        let hasChange = false;
        for (let tag of tags) {
            const oldValue = this.query[tag];
            const newValue = calculateBotValue(calc, update.bot, tag);
            if (newValue !== oldValue) {
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
