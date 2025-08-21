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
} from '@casual-simulation/aux-common';
import {
    hasValue,
    calculateBotValue,
    calculateBooleanTagValue,
    getBotMeetPortalAnchorPointOffset,
    DEFAULT_MEET_PORTAL_ANCHOR_POINT,
    calculateMeetPortalAnchorPointOffset,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { merge } from 'es-toolkit/compat';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MeetPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _visible: boolean;
    private _style: object;
    private _prejoinEnabled: boolean;
    private _startWithVideoMuted: boolean;
    private _startWithAudioMuted: boolean;
    private _requireDisplayName: boolean;
    private _disablePrivateMessages: boolean;
    private _meetJwt: string;
    private _updated: Subject<void>;
    private _language: string;

    get language(): string {
        if (hasValue(this._language)) {
            return this._language;
        } else {
            return undefined;
        }
    }

    /**
     * Gets whether the portal should be visible.
     */
    get visible(): boolean {
        if (hasValue(this._visible)) {
            return this._visible;
        } else {
            return true;
        }
    }

    /**
     * Gets the CSS style that should be applied.
     */
    get style(): object {
        if (hasValue(this._style)) {
            return this._style;
        }
        return calculateMeetPortalAnchorPointOffset(
            DEFAULT_MEET_PORTAL_ANCHOR_POINT
        );
    }

    /**
     * Gets whether the meet should have the prejoin screen enabled.
     */
    get prejoinEnabled(): boolean {
        if (hasValue(this._prejoinEnabled)) {
            return this._prejoinEnabled;
        } else {
            return true;
        }
    }

    /**
     * Gets whether the meet should start with video muted.
     */
    get startWithVideoMuted(): boolean {
        if (hasValue(this._startWithVideoMuted)) {
            return this._startWithVideoMuted;
        } else {
            return true;
        }
    }

    /**
     * Gets whether the meet should start with audio muted.
     */
    get startWithAudioMuted(): boolean {
        if (hasValue(this._startWithAudioMuted)) {
            return this._startWithAudioMuted;
        } else {
            return false;
        }
    }

    /**
     * Gets whether the meet should require the user define a display name.
     */
    get requireDisplayName(): boolean {
        if (hasValue(this._requireDisplayName)) {
            return this._requireDisplayName;
        } else {
            return true;
        }
    }

    /**
     * Gets whether the "send private message" button should be removed from the meet portal.
     */
    get disablePrivateMessages(): boolean {
        if (hasValue(this._disablePrivateMessages)) {
            return this._disablePrivateMessages;
        } else {
            return false;
        }
    }

    /**
     * Gets the JWT that was set for the meet portal.
     */
    get meetJwt(): string {
        if (hasValue(this._meetJwt)) {
            return this._meetJwt;
        } else {
            return null;
        }
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

    constructor(portalTag: string, simulation: BrowserSimulation) {
        this._portalTag = portalTag;
        this._updated = new Subject();
        this._sub = watchPortalConfigBot(simulation, portalTag)
            .pipe(
                tap((update) => {
                    const bot = update;

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
        this._visible = null;
        this._style = null;
        this._meetJwt = null;
        this._disablePrivateMessages = null;
        this._language = null;
        this._updated.next();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        this._visible = calculateBooleanTagValue(
            calc,
            bot,
            'auxMeetPortalVisible',
            null
        );

        this._style = calculateBotValue(calc, bot, 'meetPortalStyle');
        if (typeof this._style !== 'object') {
            this._style = null;
        }
        const anchorPoint = calculateBotValue(
            calc,
            bot,
            'auxMeetPortalAnchorPoint'
        );

        if (hasValue(anchorPoint)) {
            if (!this._style) {
                this._style = {};
            }
            const offset = getBotMeetPortalAnchorPointOffset(calc, bot);
            merge(this._style, offset);
        }

        this._prejoinEnabled = calculateBooleanTagValue(
            calc,
            bot,
            'meetPortalPrejoinEnabled',
            null
        );

        this._startWithVideoMuted = calculateBooleanTagValue(
            calc,
            bot,
            'meetPortalStartWithVideoMuted',
            null
        );

        this._startWithAudioMuted = calculateBooleanTagValue(
            calc,
            bot,
            'meetPortalStartWithAudioMuted',
            null
        );

        this._requireDisplayName = calculateBooleanTagValue(
            calc,
            bot,
            'meetPortalRequireDisplayName',
            null
        );

        this._disablePrivateMessages = calculateBooleanTagValue(
            calc,
            bot,
            'meetPortalDisablePrivateMessages',
            null
        );

        this._meetJwt = calculateStringTagValue(
            calc,
            bot,
            'meetPortalJWT',
            null
        );

        this._language = calculateStringTagValue(
            calc,
            bot,
            'meetPortalLanguage',
            null
        );

        this._updated.next();
    }
}
