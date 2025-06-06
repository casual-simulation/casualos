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
import { Prop } from 'vue-property-decorator';
import {
    hasValue,
    ON_CHAT_ACTION_NAME,
    onChatArg,
    ON_CHAT_TYPING_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import type { SubscriptionLike } from 'rxjs';

@Component({
    components: {},
})
export default class BotChat extends Vue {
    text: string = '';

    @Prop({ default: null }) placeholder: string;
    @Prop({ default: null }) placeholderColor: string;
    @Prop({ default: null }) foregroundColor: string;
    @Prop({ default: null }) prefill: string;

    isLoggedIn: boolean = false;
    isLoggingIn: boolean = false;
    avatarUrl: string = null;

    private _updatingText: boolean = false;
    private _sub: SubscriptionLike;

    get styleVariables() {
        return {
            '--chat-placeholder-color': this.placeholderColor || '#448aff',
            '--chat-foreground-color': this.foregroundColor || undefined,
        };
    }

    async sendMessage(dropFocus: boolean) {
        if (dropFocus) {
            const input = <Vue>this.$refs.searchInput;
            if (input) {
                (input.$el as HTMLElement).blur();
            }
        }
        await this._ignoreTextUpdates(async (text) => {
            this.text = '';
            await appManager.simulationManager.primary.helper.action(
                ON_CHAT_ACTION_NAME,
                null,
                onChatArg(text)
            );
        });
    }

    async onTextUpdated() {
        if (!this._updatingText) {
            await appManager.simulationManager.primary.helper.action(
                ON_CHAT_TYPING_ACTION_NAME,
                null,
                onChatArg(this.text)
            );
        }
    }

    async setPrefill(prefill: string) {
        await this._ignoreTextUpdates(async (text) => {
            if (!prefill) {
                return;
            }
            if (!hasValue(this.text)) {
                this.text = prefill;
            }
        });
    }

    get finalPlaceholder() {
        return this.placeholder || 'Chat';
    }

    constructor() {
        super();
    }

    uiHtmlElements(): HTMLElement[] {
        return [];
    }

    created() {
        this.isLoggedIn = false;
        this.isLoggingIn = false;
        this.avatarUrl = null;
        this._sub = appManager.whileLoggedIn((sim) => {
            return [
                sim.auth.primary.loginStatus.subscribe((status) => {
                    if (status.isLoggingIn || status.isLoading) {
                        this.isLoggingIn = true;
                        this.isLoggedIn = false;
                        this.avatarUrl = null;
                    } else if (status.authData) {
                        this.isLoggingIn = false;
                        this.isLoggedIn = true;
                        this.avatarUrl = status.authData.avatarPortraitUrl;
                    } else {
                        this.isLoggingIn = false;
                        this.isLoggedIn = false;
                        this.avatarUrl = null;
                    }
                }),
            ];
        });
    }

    mounted() {
        this.setPrefill(this.prefill);
        this.$nextTick(() => {
            this.focus();
        });
    }

    focus() {
        const search = <Vue>this.$refs.searchInput;
        if (search) {
            (search.$el as HTMLElement).focus();
        }
    }

    startChat() {
        this.focus();
    }

    login() {
        if (!this.isLoggedIn) {
            appManager.simulationManager.primary.auth.primary.authenticate();
        } else {
            appManager.authCoordinator.showAccountInfo(
                appManager.simulationManager.primary.id
            );
        }
    }

    private async _ignoreTextUpdates(action: (text: string) => Promise<void>) {
        try {
            this._updatingText = true;
            await action(this.text);
        } finally {
            this._updatingText = false;
        }
    }
}
