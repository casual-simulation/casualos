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
import HtmlApp, { resolveRegisterAppAction } from '../HtmlApp/HtmlApp';
import { v4 as uuid } from 'uuid';

@Component({
    components: {
        'html-app': HtmlApp,
    },
})
export default class HtmlAppContainer extends Vue {
    apps: AppData[] = [];

    constructor() {
        super();
    }

    // uiHtmlElements(): HTMLElement[] {
    //     return [<HTMLElement>this.$refs.botQueue];
    // }

    created() {
        this.apps = [];
    }

    mounted() {
        appManager.simulationManager.watchSimulations((sim) => {
            let sub = new Subscription();

            sub.add(
                sim.localEvents.subscribe((e) => {
                    if (e.type === 'register_html_app') {
                        const index = this.apps.findIndex(
                            (p) =>
                                p.simulationId === sim.id &&
                                p.appId === e.appId &&
                                p.key === e.instanceId
                        );

                        if (index >= 0) {
                            resolveRegisterAppAction(sim, e);
                        } else {
                            this.apps = [
                                ...this.apps,
                                {
                                    type: 'html',
                                    simulationId: sim.id,
                                    appId: e.appId,
                                    key: e.instanceId,
                                    taskId: e.taskId,
                                },
                            ];
                        }
                    } else if (e.type === 'unregister_html_app') {
                        const index = this.apps.findIndex(
                            (p) =>
                                p.simulationId === sim.id &&
                                p.appId === e.appId &&
                                p.key === e.instanceId
                        );

                        if (index >= 0) {
                            this.apps.splice(index, 1);
                        }

                        this.apps = [...this.apps];
                    }
                })
            );

            return sub;
        });
    }
}

interface AppData {
    type: 'html';
    simulationId: string;
    appId: string;
    key: string;
    taskId: number | string;
}
