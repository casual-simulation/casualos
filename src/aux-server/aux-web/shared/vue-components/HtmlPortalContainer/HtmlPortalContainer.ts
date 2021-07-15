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
import { Subscription, SubscriptionLike } from 'rxjs';
import HtmlPortal from '../HtmlPortal/HtmlPortal';

@Component({
    components: {
        'html-portal': HtmlPortal,
    },
})
export default class HtmlPortalContainer extends Vue {
    portals: PortalData[] = [];

    constructor() {
        super();
    }

    // uiHtmlElements(): HTMLElement[] {
    //     return [<HTMLElement>this.$refs.botQueue];
    // }

    created() {
        this.portals = [];
    }

    mounted() {
        appManager.simulationManager.watchSimulations((sim) => {
            let sub = new Subscription();

            sub.add(
                sim.localEvents.subscribe((e) => {
                    if (e.type === 'register_html_portal') {
                        const index = this.portals.findIndex(
                            (p) =>
                                p.simulationId === sim.id &&
                                p.portalId === e.portalId
                        );

                        if (index >= 0) {
                            this.portals.splice(index, 1);
                        }

                        this.portals = [
                            ...this.portals,
                            {
                                type: 'html',
                                simulationId: sim.id,
                                portalId: e.portalId,
                                taskId: e.taskId,
                            },
                        ];
                    }
                })
            );

            return sub;
        });
    }
}

interface PortalData {
    type: 'html';
    simulationId: string;
    portalId: string;
    taskId: number | string;
}
