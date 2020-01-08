import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import { flatMap, tap, withLatestFrom } from 'rxjs/operators';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    isBot,
    PrecalculatedBot,
    isPrecalculated,
    isExistingBot,
    createPrecalculatedBot,
    filterBotsBySelection,
} from '@casual-simulation/aux-common';

/**
 * Defines a class that manages the bot panel.
 */
export class BotPanelManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;

    private _dimensionId: string;
    private _botsUpdated: BehaviorSubject<BotsUpdatedEvent>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever the list of selected bots is updated.
     */
    get botsUpdated(): Observable<BotsUpdatedEvent> {
        return this._botsUpdated;
    }

    /**
     * Creates a new bot panel manager.
     * @param watcher The bot watcher to use.
     * @param helper The bot helper to use.
     * @param recent The recent bots manager to use.
     * @param dimensionId The ID of the dimension to show.
     */
    constructor(watcher: BotWatcher, helper: BotHelper, dimensionId: string) {
        this._watcher = watcher;
        this._helper = helper;
        this._dimensionId = dimensionId;
        this._botsUpdated = new BehaviorSubject<BotsUpdatedEvent>({
            bots: [],
            isDiff: false,
        });

        this._subs.push(
            this._calculateBotsUpdated().subscribe(this._botsUpdated)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach(s => s.unsubscribe());
            this._subs = null;
        }
    }

    private _calculateBotsUpdated(): Observable<BotsUpdatedEvent> {
        const allBotsSelectedUpdatedAddedAndRemoved = merge(
            this._watcher.botsDiscovered,
            this._watcher.botsUpdated,
            this._watcher.botsRemoved
        );
        return allBotsSelectedUpdatedAddedAndRemoved.pipe(
            flatMap(async () => {
                if (this._dimensionId) {
                    return {
                        bots: filterBotsBySelection(
                            this._helper.objects,
                            this._dimensionId
                        ),
                        isDiff: false,
                    };
                }
                return {
                    bots: this._helper.objects,
                    isDiff: false,
                };
            })
        );
    }
}

export interface BotsUpdatedEvent {
    bots: PrecalculatedBot[];
    isDiff: boolean;
}
