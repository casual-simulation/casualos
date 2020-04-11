import 'zone.js';
import { Subscription, SubscriptionLike } from 'rxjs';

/**
 * Defines a zone specification that tracks active tasks and is able to cancel them all when
 * a cleanup is triggered.
 */
export class CleanupZoneSpec implements ZoneSpec, SubscriptionLike {
    name: string;

    private _sub: Subscription;
    private _tasks: [Zone, Task][];

    constructor() {
        this.name = 'CleanupZone';
        this._sub = new Subscription(() => {
            while (this._tasks.length > 0) {
                const [zone, task] = this._tasks.pop();
                if (task.state === 'scheduling') {
                    task.cancelScheduleRequest();
                } else if (task.state === 'notScheduled') {
                } else {
                    zone.cancelTask(task);
                }
            }
        });
        this._tasks = [];
    }

    onScheduleTask(
        parentZoneDelegate: ZoneDelegate,
        currentZone: Zone,
        targetZone: Zone,
        task: Task
    ) {
        if (this.closed) {
            task.cancelScheduleRequest();
            return task;
        } else if (task.type !== 'microTask') {
            this._tasks.push([targetZone, task]);
        }
        return parentZoneDelegate.scheduleTask(targetZone, task);
    }

    get closed() {
        return this._sub.closed;
    }

    unsubscribe() {
        return this._sub.unsubscribe();
    }
}
