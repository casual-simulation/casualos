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
    getBotMeetPortalAnchorPointOffset,
    DEFAULT_MEET_PORTAL_ANCHOR_POINT,
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_TAG_PORTAL_ANCHOR_POINT,
    getBotTagPortalAnchorPointOffset,
    calculateStringTagValue,
    Bot,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { Simulation } from '@casual-simulation/aux-vm';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class IdePortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _updated: Subject<void>;
    private _showButton: boolean;
    private _buttonIcon: string;
    private _buttonHint: string;
    private _configBot: Bot;
    private _simulation: Simulation;

    get showButton(): boolean {
        if (hasValue(this._showButton)) {
            return this._showButton;
        }
        return true;
    }

    get buttonIcon(): string {
        if (hasValue(this._buttonIcon)) {
            return this._buttonIcon;
        }
        return null;
    }

    get buttonHint(): string {
        if (hasValue(this._buttonHint)) {
            return this._buttonHint;
        }
        return null;
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

    get configBot() {
        return this._configBot;
    }

    constructor(portalTag: string, simulation: BrowserSimulation) {
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
        this._showButton = null;
        this._buttonIcon = null;
        this._buttonHint = null;
        this._updated.next();
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        portalTag: string
    ) {
        this._showButton = calculateBooleanTagValue(
            calc,
            bot,
            'auxIdePortalShowButton',
            null
        );
        this._buttonIcon = calculateStringTagValue(
            calc,
            bot,
            'auxIdePortalButtonIcon',
            null
        );
        this._buttonHint = calculateStringTagValue(
            calc,
            bot,
            'auxIdePortalButtonHint',
            null
        );
        this._updated.next();
    }
}
