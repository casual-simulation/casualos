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
import type {
    BotCalculationContext,
    PrecalculatedBot,
    Bot,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    calculateBotValue,
    CLICK_ACTION_NAME,
    onClickArg,
} from '@casual-simulation/aux-common';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { Simulation } from '@casual-simulation/aux-vm';
import type { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MenuPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _updated: Subject<void>;
    private _style: object;
    private _configBot: Bot;
    private _simulation: Simulation;

    /**
     * Gets the CSS style that should be applied.
     */
    get style(): object {
        if (hasValue(this._style)) {
            return this._style;
        }
        return {};
    }

    unsubscribe(): void {
        this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get portalTag() {
        return this._portalTag;
    }

    get onUpdated(): Observable<void> {
        return this._updated;
    }

    buttonClick() {
        if (!this._simulation || !this._configBot) {
            return;
        }
        const dimension = calculateBotValue(
            null,
            this._simulation.helper.userBot,
            this._portalTag
        );
        this._simulation.helper.action(
            CLICK_ACTION_NAME,
            [this._configBot],
            onClickArg(null, dimension, null, 'mouse', null, null, null)
        );
    }

    constructor(portalTag: string, simulation: RemoteSimulation) {
        this._portalTag = portalTag;
        this._updated = new Subject();
        this._simulation = simulation;
        this._sub = watchPortalConfigBot(simulation, portalTag)
            .pipe(
                tap((update) => {
                    const bot = update;
                    this._configBot = bot;

                    if (bot) {
                        const calc = simulation.helper.createContext();
                        this._updatePortalValues(calc, bot, portalTag);
                    } else {
                        this._clearPortalValues();
                    }
                })
            )
            .subscribe();
    }

    protected _clearPortalValues() {
        this._style = null;
        this._updated.next();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        this._style = calculateBotValue(calc, bot, 'menuPortalStyle');
        if (typeof this._style !== 'object') {
            this._style = null;
        }

        this._updated.next();
    }
}
