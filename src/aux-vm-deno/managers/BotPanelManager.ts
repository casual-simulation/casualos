import {
    Subject,
    Observable,
    BehaviorSubject,
    merge,
    from,
    SubscriptionLike,
} from 'rxjs';
import { flatMap, tap, withLatestFrom, bufferTime } from 'rxjs/operators';
import { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import {
    isBot,
    PrecalculatedBot,
    isPrecalculated,
    isExistingBot,
    createPrecalculatedBot,
    filterBotsBySelection,
    botsInDimension,
} from '@casual-simulation/aux-common';

/**
 * Defines a class that manages the bot panel.
 */
export class BotPanelManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _buffer: boolean;

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
     * @param bufferEvents Whether to buffer the update events.
     */
    constructor(
        watcher: BotWatcher,
        helper: BotHelper,
        bufferEvents: boolean = true
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._buffer = bufferEvents;
        this._botsUpdated = new BehaviorSubject<BotsUpdatedEvent>({
            bots: [],
            isDiff: false,
            hasPortal: false,
            dimension: null,
            isSingleBot: false,
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
        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsSelectedUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsSelectedUpdatedAddedAndRemoved;
        return bufferedEvents.pipe(
            flatMap(async () => {
                if (this._helper.userBot) {
                    const dimension = this._helper.userBot.values.sheetPortal;
                    if (!!dimension && dimension !== true) {
                        const bots = filterBotsBySelection(
                            this._helper.objects,
                            dimension
                        );
                        const singleBot =
                            bots.length === 1 && bots[0].id === dimension;
                        return {
                            bots: bots,
                            hasPortal: true,
                            dimension: dimension,
                            isDiff: false,
                            isSingleBot: singleBot,
                        };
                    } else if (dimension === true) {
                        return {
                            bots: this._helper.objects,
                            hasPortal: true,
                            dimension: null,
                            isDiff: false,
                            isSingleBot: false,
                        };
                    }
                }
                return {
                    bots: [],
                    hasPortal: false,
                    dimension: null,
                    isDiff: false,
                    isSingleBot: false,
                };
            })
        );
    }
}

export interface BotsUpdatedEvent {
    bots: PrecalculatedBot[];
    dimension: string;
    hasPortal: boolean;
    isDiff: boolean;
    isSingleBot: boolean;
}
