import {
    hasValue,
    calculateBotValue,
    BotCalculationContext,
    PrecalculatedBot,
    calculateBooleanTagValue,
    getBotMeetPortalAnchorPointOffset,
    DEFAULT_MEET_PORTAL_ANCHOR_POINT,
    calculateMeetPortalAnchorPointOffset,
} from '@casual-simulation/aux-common';
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
    private _prejoinEnabled: boolean;
    private _startWithVideoMuted: boolean;
    private _startWithAudioMuted: boolean;
    private _requireDisplayName: boolean;
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

        this._updated.next();
    }
}
