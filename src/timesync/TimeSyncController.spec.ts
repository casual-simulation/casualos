import { TimeSyncController } from './TimeSyncController';
import { TimeSyncConnection } from './TimeSyncConnection';
import { TimeSync } from './TimeSync';

describe('TimeSyncController', () => {
    let controller: TimeSyncController;
    let connection = {
        sampleServerTime: jest.fn(),
        closed: false,
        unsubscribe: jest.fn()
    };;

    beforeEach(() => {
        jest.useFakeTimers('modern');
        connection = {
            sampleServerTime: jest.fn(),
            closed: false,
            unsubscribe: jest.fn()
        };
        controller = new TimeSyncController(connection);

        connection.sampleServerTime.mockResolvedValue({
            clientRequestTime: 0,
            serverReceiveTime: 0,
            serverTransmitTime: 0,
            currentTime: 0
        });
    });


    afterEach(() => {
        jest.useRealTimers();
        controller.unsubscribe();
    });

    it('should emit query every second', async () => {
        jest.advanceTimersByTime(1000);

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(0);

        controller.init();

        jest.advanceTimersByTime(1000);
        jest.runAllTicks();
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1000);
        jest.runAllTicks();
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(2);
    });

    it('should slow the query rate to once every 10 seconds after 15 samples have been taken', async () => {
        controller.init();

        for(let i = 0; i < 15; i++) {
            expect(connection.sampleServerTime).toHaveBeenCalledTimes(i);
            
            jest.advanceTimersByTime(1000);
            jest.runAllTicks();
            await waitAsync();
        }

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(15);

        jest.advanceTimersByTime(1000);
        jest.runAllTicks();
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(15);

        jest.advanceTimersByTime(9000);
        jest.runAllTicks();
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(16);
    });

    it('should add samples to the time sync class', async () => {
        jest.advanceTimersByTime(1000);
        jest.runAllTicks();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(0);

        connection.sampleServerTime.mockResolvedValueOnce({
            clientRequestTime: 100,
            serverReceiveTime: 200,
            serverTransmitTime: 300,
            currentTime: 400
        });
        controller.init();

        jest.advanceTimersByTime(1000);
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(1);

        connection.sampleServerTime.mockResolvedValueOnce({
            clientRequestTime: 500,
            serverReceiveTime: 600,
            serverTransmitTime: 700,
            currentTime: 801
        });

        jest.advanceTimersByTime(1000);
        await waitAsync();

        expect(connection.sampleServerTime).toHaveBeenCalledTimes(2);

        expect(controller.sync.getSamples()).toEqual([ 
            {
                clientRequestTime: 100,
                serverReceiveTime: 200,
                serverTransmitTime: 300,
                currentTime: 400
            },
            {
                clientRequestTime: 500,
                serverReceiveTime: 600,
                serverTransmitTime: 700,
                currentTime: 801
            }
        ]);
    });

});

export async function waitAsync() {
    return new Promise(resolve => jest.requireActual('timers').setImmediate(resolve));
}