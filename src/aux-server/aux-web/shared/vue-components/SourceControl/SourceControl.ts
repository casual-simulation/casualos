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

import DefaultPanel from './components/DefaultPanel/DefaultPanel.vue';
import type { SubscriptionLike } from 'rxjs';
import type { Bot } from '@casual-simulation/aux-common';
import type { SystemPortalSelectionUpdate } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';

@Component({
    name: 'source-control',
    components: {
        'default-panel': DefaultPanel,
    },
})
export default class SourceControl extends Vue {
    private _subs: SubscriptionLike[] = [];
    private _selectedBot: Bot | null = null;
    currentPanel: string = 'default-panel';

    get botId() {
        return this._selectedBot ? this._selectedBot.id : null;
    }
    get botSystem() {
        return this._selectedBot
            ? this._selectedBot.tags['system'] || null
            : null;
    }

    get selectedBot() {
        return this._selectedBot;
    }
    set selectedBot(value: Bot | null) {
        this._selectedBot = value;
    }

    get selectedBotId() {
        return this._selectedBot ? this._selectedBot.id : null;
    }

    private loadGitConfig(config: any) {
        console.log('load git panel', config);
    }

    private onSelectionUpdated(e: SystemPortalSelectionUpdate) {
        if (e.hasSelection === false) return;
        // Tag change specific logic should go before the botId check
        if (e.bot.id === this.selectedBotId) return;
        console.log('selection updated', e, this.selectedBot);
        const b = (this.selectedBot = e.bot);
    }

    constructor() {
        super();
        this._subs.push(
            appManager.systemPortal.onSelectionUpdated.subscribe(
                this.onSelectionUpdated
            )
        );
    }
    initRepo() {
        appManager.sourceControlController.init();
    }
    cloneRepo() {
        console.log('clone repo');
    }
    loadRepo() {
        console.log('load repo');
    }
    selectBot() {
        //TODO: implement or rem.
    }
}
