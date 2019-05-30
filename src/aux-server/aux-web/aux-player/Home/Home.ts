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
} from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager } from '../../shared/AppManager';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Route } from 'vue-router';
import { difference } from 'lodash';

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class Home extends Vue {
    @Prop() context: string;
    @Prop() channels: string | string[];

    debug: boolean = false;

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

    constructor() {
        super();
    }

    async created() {}

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
