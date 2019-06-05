import { Observable, Observer } from 'rxjs';
import { WorkerMessage } from './WorkerMessages';

/**
 * Creates a new observable that listens to the given worker for messages.
 * @param worker The worker to listen to.
 */
export function createWorkerObservable(
    worker: Worker
): Observable<WorkerMessage> {
    return Observable.create((observer: Observer<any>) => {
        const listener = (message: MessageEvent) => {
            observer.next(message.data);
        };
        const errorListener = (error: ErrorEvent) => {
            observer.error(error);
        };
        worker.addEventListener('message', listener);
        worker.addEventListener('error', errorListener);

        return () => {
            worker.removeEventListener('message', listener);
            worker.removeEventListener('error', errorListener);
        };
    });
}
