import {
    hasValue,
    calculateBotValue,
    BotCalculationContext,
    PrecalculatedBot,
    calculateBooleanTagValue,
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_TAG_PORTAL_ANCHOR_POINT,
    getBotTagPortalAnchorPointOffset,
    calculateStringTagValue,
    Bot,
    CLICK_ACTION_NAME,
    onClickArg,
} from '@casual-simulation/aux-common';
import {
    BrowserSimulation,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { SubscriptionLike, Subscription, Subject, Observable } from 'rxjs';
import { merge } from 'lodash';
import { Simulation } from '@casual-simulation/aux-vm';

/**
 * Defines a class that is able to watch dimension confic bots and update values.
 */
export class TagPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _updated: Subject<void>;
    private _style: Object;
    private _showButton: boolean;
    private _buttonIcon: string;
    private _buttonHint: string;
    private _configBot: Bot;
    private _simulation: Simulation;

    /**
     * Gets the CSS style that should be applied.
     */
    get style(): Object {
        if (hasValue(this._style)) {
            return this._style;
        }
        return calculateMeetPortalAnchorPointOffset(
            DEFAULT_TAG_PORTAL_ANCHOR_POINT
        );
    }

    get showButton(): boolean {
        if (hasValue(this._showButton)) {
            return this._showButton;
        }
        return false;
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
            onClickArg(null, dimension, null, 'mouse', null, null)
        );
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
        this._style = null;
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
        this._style = calculateBotValue(calc, bot, 'tagPortalStyle');
        if (typeof this._style !== 'object') {
            this._style = null;
        }
        const anchorPoint = calculateBotValue(
            calc,
            bot,
            'auxTagPortalAnchorPoint'
        );

        if (hasValue(anchorPoint)) {
            if (!this._style) {
                this._style = {
                    top: null,
                    bottom: null,
                    height: null,
                    width: null,
                    'min-height': null,
                    'min-width': null,
                    left: null,
                    right: null,
                };
            }
            const offset = getBotTagPortalAnchorPointOffset(calc, bot);
            merge(this._style, offset);
        }

        this._showButton = calculateBooleanTagValue(
            calc,
            bot,
            'auxTagPortalShowButton',
            null
        );
        this._buttonIcon = calculateStringTagValue(
            calc,
            bot,
            'auxTagPortalButtonIcon',
            null
        );
        this._buttonHint = calculateStringTagValue(
            calc,
            bot,
            'auxTagPortalButtonHint',
            null
        );
        this._updated.next();
    }
}
