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
import {
    hasValue,
    calculateBooleanTagValue,
    calculateStringTagValue,
    calculateStringListTagValue,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { watchPortalConfigBot } from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import type { SubscriptionLike, Observable } from 'rxjs';
import { Subscription, Subject } from 'rxjs';
import type { Simulation } from '@casual-simulation/aux-vm';

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
