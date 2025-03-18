import type { ProgressMessage } from '@casual-simulation/aux-common';
import type { AuxVM } from '../vm/AuxVM';
import type { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { tap, takeWhile } from 'rxjs/operators';

/**
 * Defines a class that can manage the current loading progress state of a simulation.
 */
export class ProgressManager implements SubscriptionLike {
    private _progress: BehaviorSubject<ProgressMessage>;
    private _vm: AuxVM;
    private _sub: Subscription;

    get updates(): Observable<ProgressMessage> {
        return this._progress;
    }

    constructor(vm: AuxVM) {
        this._vm = vm;

        this._progress = new BehaviorSubject<ProgressMessage>({
            type: 'progress',
            progress: 0,
            message: 'Starting...',
        });
        this._sub = this._vm.connectionStateChanged
            .pipe(
                takeWhile((m) => m.type !== 'init'),
                tap((message) => {
                    if (message.type === 'progress') {
                        this._progress.next(message);
                    } else if (message.type === 'authorization') {
                        if (message.authorized === false) {
                            this._progress.next({
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authorized.',
                                error: true,
                            });
                        }
                    } else if (message.type === 'authentication') {
                        if (message.authenticated === false) {
                            this._progress.next({
                                type: 'progress',
                                progress: 1,
                                message: 'You are not authenticated.',
                                done: true,
                            });
                        }
                    }
                })
            )
            .subscribe({
                error: (err) => console.error(err),
                complete: () => {
                    this._progress.next({
                        type: 'progress',
                        message: 'Done.',
                        progress: 1,
                        done: true,
                    });
                },
            });
    }

    unsubscribe() {
        this._sub.unsubscribe();
    }

    get closed() {
        return this._sub.closed;
    }
}
