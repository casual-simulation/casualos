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
    DEFAULT_TAG_PORTAL_ANCHOR_POINT,
    getBotTagPortalAnchorPointOffset,
    calculateStringTagValue,
    Bot,
    CLICK_ACTION_NAME,
    onClickArg,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { Simulation } from '@casual-simulation/aux-vm';
import { RemoteSimulation } from '@casual-simulation/aux-vm-client';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class MenuPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _updated: Subject<void>;
    private _style: Object;
    private _configBot: Bot;
    private _simulation: Simulation;

    /**
     * Gets the CSS style that should be applied.
     */
    get style(): Object {
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
            onClickArg(null, dimension)
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
