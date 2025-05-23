/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import Vue from 'vue';
import Component from 'vue-class-component';
import { customAppContainerAvailable } from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import HtmlApp from '../HtmlApp/HtmlApp';
import { resolveRegisterAppAction } from '../HtmlApp/Util';

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

            sim.helper.transaction(customAppContainerAvailable());

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
