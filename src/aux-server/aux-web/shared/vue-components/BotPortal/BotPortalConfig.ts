import type {
    BotCalculationContext,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    calculateBotValue,
    DEFAULT_MEET_PORTAL_ANCHOR_POINT,
    calculateMeetPortalAnchorPointOffset,
    getBotPortalAnchorPoint,
    calculateStringTagValue,
    BOT_PORTAL,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { merge } from 'lodash';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class BotPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _style: object;
    private _updated: Subject<void>;

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
        this._style = null;
        this._updated.next();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        this._style = calculateBotValue(calc, bot, 'botPortalStyle');
        if (typeof this._style !== 'object') {
            this._style = null;
        }
        const anchorPoint = calculateBotValue(
            calc,
            bot,
            'auxBotPortalAnchorPoint'
        );

        if (hasValue(anchorPoint)) {
            if (!this._style) {
                this._style = {};
            }
            const offset = getBotPortalAnchorPoint(calc, bot);
            merge(this._style, offset);
        }

        this._updated.next();
    }
}
