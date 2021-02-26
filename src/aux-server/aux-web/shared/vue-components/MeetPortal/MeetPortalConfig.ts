import {
    isDimensionLocked,
    DEFAULT_PORTAL_ZOOMABLE,
    DEFAULT_PORTAL_PANNABLE,
    hasValue,
    calculateBotValue,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    DEFAULT_PORTAL_ROTATABLE,
    PortalPointerDragMode,
    DEFAULT_PORTAL_POINTER_DRAG_MODE,
    calculatePortalPointerDragMode,
    getBotMeetPortalAnchorPointOffset,
    DEFAULT_MEET_PORTAL_ANCHOR_POINT,
    calculateMeetPortalAnchorPointOffset,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { merge } from 'lodash';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MeetPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _visible: boolean;
    private _style: Object;
    private _updated: Subject<void>;

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
    get style(): Object {
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
        this._visible = null;
        this._style = null;
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
        this._updated.next();
    }
}
