jest.useFakeTimers();

import { BatchingZoneSpec } from './BatchingZoneSpec';
import { waitAsync } from '../test/TestHelpers';
import { CleanupZoneSpec } from './CleanupZoneSpec';

console.warn = jest.fn();

describe('BatchingZoneSpec', () => {
    let flush: jest.Mock<any>;
    let zone: Zone;
    let cleanup: CleanupZoneSpec;

    beforeEach(() => {
        Zone.assertZonePatched();

        flush = jest.fn();

        cleanup = new CleanupZoneSpec();
        let wrapper = Zone.root.fork(cleanup);

        zone = wrapper.fork(new BatchingZoneSpec(flush));
    });

    afterEach(() => {
        cleanup.unsubscribe();
    });

    it('should trigger the flush callback when running a synchronous task', () => {
        const result = zone.run(() => {
            return 1 + 2;
        });

        expect(result).toEqual(3);
        expect(flush).toBeCalledTimes(1);
    });

    it('should trigger the flush callback when a promise (micro task) is created', async () => {
        const task = jest.fn();
        const result = zone.run(() => {
            return Promise.resolve(0).then(task);
        });

        expect(task).not.toBeCalled();
        expect(flush).toBeCalledTimes(1);

        await waitAsync();

        expect(task).toBeCalledTimes(1);
        expect(flush).toBeCalledTimes(2);
    });

    it('should trigger the flush callback when a macro task finishes', () => {
        const task = jest.fn();
        const result = zone.run(() => {
            setTimeout(() => task(), 1000);
        });

        expect(flush).toBeCalledTimes(1);

        jest.advanceTimersByTime(1001);

        expect(task).toBeCalledTimes(1);
        expect(flush).toBeCalledTimes(2);
    });

    it('should trigger the flush callback when an interval task executes', () => {
        const task = jest.fn();
        const result = zone.run(() => {
            setInterval(() => task(), 1000);
        });

        expect(flush).toBeCalledTimes(1);

        jest.advanceTimersByTime(1001);

        expect(task).toBeCalledTimes(1);
        expect(flush).toBeCalledTimes(2);

        jest.advanceTimersByTime(1001);

        expect(task).toBeCalledTimes(2);
        expect(flush).toBeCalledTimes(3);
    });

    it('should batch micro tasks together', async () => {
        const task1 = jest.fn();
        const task2 = jest.fn();
        const result = zone.run(() => {
            return Promise.resolve(0)
                .then(task1)
                .then(task2);
        });

        expect(flush).toBeCalledTimes(1);
        expect(task1).not.toBeCalled();
        expect(task2).not.toBeCalled();

        await waitAsync();

        expect(task1).toBeCalledTimes(1);
        expect(task2).toBeCalledTimes(1);
        expect(flush).toBeCalledTimes(3);
    });

    it('should support nested calls', () => {
        const result = zone.run(() => {
            return zone.run(() => {
                return 1 + 2;
            });
        });

        expect(result).toEqual(3);
        expect(flush).toBeCalledTimes(1);
    });

    it('should support running in the zone while in flush', () => {
        const task1 = jest.fn();
        const task2 = jest.fn();
        flush.mockImplementation(() => {
            zone.run(task1);
            zone.run(task2);
        });

        const result = zone.run(() => {
            return 1 + 2;
        });

        expect(result).toEqual(3);
        expect(flush).toBeCalledTimes(1);
        expect(task1).toBeCalledTimes(1);
        expect(task2).toBeCalledTimes(1);
    });
});
