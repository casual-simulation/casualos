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
    calculateStringListTagValue,
} from '@casual-simulation/aux-common';
import { Color } from '@casual-simulation/three';
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
export class SheetPortalConfig implements SubscriptionLike {
    private _sub: Subscription;
    private _portalTag: string;
    private _updated: Subject<void>;
    private _showButton: boolean;
    private _buttonIcon: string;
    private _buttonHint: string;
    private _allowedTags: string[];
    private _addedTags: string[];
    private _simulations: Simulation[];

    get showButton(): boolean {
        if (hasValue(this._showButton)) {
            return this._showButton;
        }
        return null;
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

    get allowedTags(): string[] {
        if (hasValue(this._allowedTags)) {
            return this._allowedTags;
        }
        return null;
    }

    get addedTags(): string[] {
        if (hasValue(this._addedTags)) {
            return this._addedTags;
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

    get simulations() {
        return this._simulations;
    }

    /**
     * Adds the given simulation to the config.
     * @param simulation
     */
    addSimulation(simulation: BrowserSimulation): SubscriptionLike {
        const sub = watchPortalConfigBot(simulation, this._portalTag)
            .pipe(
                tap(() => {
                    this._updatePortalValues(this._portalTag);
                })
            )
            .subscribe();
        this._simulations.push(simulation);
        sub.add(() => {
            const index = this._simulations.indexOf(simulation);
            if (index >= 0) {
                this._simulations.splice(index, 1);
            }
        });
        this._sub.add(sub);
        return sub;
    }

    constructor(portalTag: string) {
        this._portalTag = portalTag;
        this._updated = new Subject();
        this._simulations = [];
        this._sub = new Subscription();
    }

    protected _updatePortalValues(portalTag: string) {
        let showButton: boolean = null;
        let buttonIcon: string = null;
        let buttonHint: string = null;
        let allowedTags: string[] = null;
        let addedTags: string[] = null;

        for (let sim of this._simulations) {
            const calc = sim.helper.createContext();
            const bot = sim.helper.userBot;

            if (!bot) {
                continue;
            }

            if (!hasValue(showButton)) {
                showButton = calculateBooleanTagValue(
                    calc,
                    bot,
                    'auxSheetPortalShowButton',
                    null
                );
            }
            if (!hasValue(buttonIcon)) {
                buttonIcon = calculateStringTagValue(
                    calc,
                    bot,
                    'auxSheetPortalButtonIcon',
                    null
                );
            }

            if (!hasValue(buttonHint)) {
                buttonHint = calculateStringTagValue(
                    calc,
                    bot,
                    'auxSheetPortalButtonHint',
                    null
                );
            }

            const newAllowedTags = calculateStringListTagValue(
                calc,
                bot,
                'auxSheetPortalAllowedTags',
                null
            );

            if (hasValue(newAllowedTags)) {
                if (!hasValue(allowedTags)) {
                    allowedTags = [];
                }

                allowedTags.push(...newAllowedTags);
            }

            const newAddedTags = calculateStringListTagValue(
                calc,
                bot,
                'auxSheetPortalAddedTags',
                null
            );

            if (hasValue(newAddedTags)) {
                if (!hasValue(addedTags)) {
                    addedTags = [];
                }

                addedTags.push(...newAddedTags);
            }
        }

        this._showButton = showButton;
        this._buttonIcon = buttonIcon;
        this._buttonHint = buttonHint;
        this._allowedTags = allowedTags;
        this._addedTags = addedTags;
        this._updated.next();
    }
}
