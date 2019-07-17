import Vue from 'vue';
import { Chrome } from 'vue-color';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Object,
    File,
    getUserMode,
    UserMode,
    DEFAULT_USER_MODE,
    Workspace,
    goToContext,
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';
import { tap, first } from 'rxjs/operators';
import { Route } from 'vue-router';
import { difference } from 'lodash';

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class PlayerHome extends Vue {
    @Prop() context: string;
    @Prop() channels: string | string[];
    @Prop() primaryChannel: string;

    debug: boolean = false;
    isLoading: boolean = false;

    get user() {
        return appManager.user;
    }

    get fileManager() {
        return appManager.simulationManager.primary;
    }

    @Watch('channels')
    async onRouteChanged(
        newChannels: string | string[],
        oldChannels: string | string[]
    ) {
        await this._updateChannels(newChannels);
    }

    @Watch('context')
    async onContextChanged() {
        if (
            appManager.simulationManager.primary.parsedId.context !==
            this.context
        ) {
            await appManager.simulationManager.primary.helper.transaction(
                goToContext(this.context)
            );
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        const sim = await appManager.setPrimarySimulation(
            `${this.context}/${this.primaryChannel}`
        );

        sim.connection.syncStateChanged
            .pipe(first(synced => synced))
            .subscribe(() => {
                this.isLoading = false;
            });

        // this.isLoading = false;
    }

    async mounted() {
        this._updateChannels(this.channels);
    }

    private async _updateChannels(newChannels: string | string[]) {
        newChannels = newChannels || [];

        if (!Array.isArray(newChannels)) {
            newChannels = [newChannels];
        }

        for (let i = 0; i < newChannels.length; i++) {
            await appManager.simulationManager.primary.helper.createSimulation(
                newChannels[i]
            );
        }
    }
}
