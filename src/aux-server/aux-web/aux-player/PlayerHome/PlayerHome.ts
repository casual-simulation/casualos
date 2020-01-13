import Vue from 'vue';
import Component from 'vue-class-component';
import { Watch, Prop } from 'vue-property-decorator';
import { goToDimension } from '@casual-simulation/aux-common';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { appManager } from '../../shared/AppManager';
import { first } from 'rxjs/operators';

@Component({
    components: {
        'game-view': PlayerGameView,
    },
})
export default class PlayerHome extends Vue {
    @Prop() dimension: string;
    @Prop() channels: string | string[];
    @Prop() primaryChannel: string;

    debug: boolean = false;
    isLoading: boolean = false;

    get user() {
        return appManager.user;
    }

    get botManager() {
        return appManager.simulationManager.primary;
    }

    @Watch('channels')
    async onRouteChanged(
        newChannels: string | string[],
        oldChannels: string | string[]
    ) {
        await this._updateChannels(newChannels);
    }

    @Watch('dimension')
    async onDimensionChanged() {
        if (
            appManager.simulationManager.primary.parsedId.dimension !==
            this.dimension
        ) {
            await appManager.simulationManager.primary.helper.transaction(
                goToDimension(this.dimension)
            );
        }
    }

    constructor() {
        super();
    }

    async created() {
        this.isLoading = true;
        const sim = await appManager.setPrimarySimulation(
            `${this.dimension}/${this.primaryChannel}`
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
