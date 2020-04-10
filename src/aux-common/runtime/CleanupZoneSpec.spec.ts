jest.useFakeTimers();

import { CleanupZoneSpec } from './CleanupZoneSpec';
import { waitAsync } from '../test/TestHelpers';

console.warn = jest.fn();

describe('CleanupZoneSpec', () => {
    let spec: CleanupZoneSpec;
    let zone: Zone;

    beforeEach(() => {
        Zone.assertZonePatched();

        spec = new CleanupZoneSpec();
        zone = Zone.current.fork(spec);
    });

    afterEach(() => {
        spec.unsubscribe();
    });

    it('should cancel setInterval() when cleanup() is triggered', () => {
        let fn = jest.fn();

        zone.run(() => {
            setInterval(fn, 100);
        });

        jest.advanceTimersByTime(200);

        expect(fn).toBeCalledTimes(2);

        spec.unsubscribe();

        jest.advanceTimersByTime(200);

        expect(fn).toBeCalledTimes(2);
    });

    it('should prevent setTimeout() when unsubscribe() is triggered', () => {
        let fn = jest.fn();

        zone.run(() => {
            setTimeout(fn, 100);
        });

        expect(fn).toBeCalledTimes(0);

        spec.unsubscribe();

        jest.advanceTimersByTime(200);

        expect(fn).toBeCalledTimes(0);
    });

    it('should let setTimeout() run normally if not cancelled', () => {
        let fn = jest.fn();

        zone.run(() => {
            setTimeout(fn, 100);
        });

        jest.advanceTimersByTime(200);
        expect(fn).toBeCalledTimes(1);
    });

    it('should prevent promise.then() callbacks', async () => {
        let fn = jest.fn();

        zone.run(() => {
            Promise.resolve()
                .then(() => {
                    spec.unsubscribe();
                })
                .then(() => fn());
        });

        await waitAsync();

        expect(fn).toBeCalledTimes(0);
    });

    it('should let promise.then() callbacks run normally if not cancelled', async () => {
        let fn = jest.fn();

        zone.run(() => {
            Promise.resolve()
                .then(() => {})
                .then(() => fn());
        });

        await waitAsync();

        expect(fn).toBeCalledTimes(1);
    });

    it('should be able to cancel tasks that are made in child zones', () => {
        let fn = jest.fn();

        let fork = zone.fork({
            name: 'test',
        });
        fork.run(() => {
            setInterval(fn, 100);
        });

        jest.advanceTimersByTime(200);

        expect(fn).toBeCalledTimes(2);

        spec.unsubscribe();

        jest.advanceTimersByTime(200);

        expect(fn).toBeCalledTimes(2);
    });
});
