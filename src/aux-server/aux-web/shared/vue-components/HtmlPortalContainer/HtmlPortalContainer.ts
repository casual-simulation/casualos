import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch, Provide } from 'vue-property-decorator';
import {
    Bot,
    getShortId,
    formatValue,
    tagsOnBot,
    hasValue,
    runScript,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike } from 'rxjs';

@Component({
    components: {},
})
export default class HtmlPortalContainer extends Vue {
    constructor() {
        super();
    }

    uiHtmlElements(): HTMLElement[] {
        return [<HTMLElement>this.$refs.botQueue];
    }

    mounted() {
        appManager.simulationManager.watchSimulations((sim) => {});
        appManager.simulationManager.simulationAdded.subscribe((sim) => {});

        appManager.simulationManager.simulationRemoved.subscribe((sim) => {});
    }

    isEmptyOrDiff(f: Bot): boolean {
        return tagsOnBot(f).length === 0 || f.id === 'mod';
    }

    startSearch() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            search.$el.focus();
        }
    }
}
