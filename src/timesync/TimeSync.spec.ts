import { TimeSync } from './TimeSync';

describe('TimeSync', () => {
    let sync: TimeSync;
    
    beforeEach(() => {
        sync = new TimeSync();
    }); 

    describe('addSample()', () => {
        describe('perfect sync', () => {
            it('should calculate a time offset', () => {
                // 10ms latency
                sync.addSample(offset(0, 10, 0));

                expect(sync.offsetMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(10);
                expect(sync.calculatedTimeLatencyMS).toBe(10);
                expect(sync.numIncludedSamples).toBe(1);
            });

            it('should use multiple samples to calculate the time offset', () => {
                // 10ms latency
                sync.addSample(offset(0, 10, 0));

                // 20ms latency
                sync.addSample(offset(100, 20, 0));

                // 30ms latency
                sync.addSample(offset(200, 30, 0));

                expect(sync.offsetMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(20);
                expect(sync.calculatedTimeLatencyMS).toBe(20);
                expect(sync.numIncludedSamples).toBe(3);
                expect(sync.offsetSpreadMS).toBe(0);
            });

            it('should support "negative" latency', () => {
                // 10ms latency
                sync.addSample(offset(0, -10, 0));

                // 20ms latency
                sync.addSample(offset(100, -20, 0));

                // 30ms latency
                sync.addSample(offset(200, -30, 0));

                expect(sync.offsetMS).toBe(0);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(-20);
                expect(sync.calculatedTimeLatencyMS).toBe(-20);
                expect(sync.numIncludedSamples).toBe(3);
            });
        });

        describe('consistent offset', () => {
            it('should calculate a time offset', () => {
                // 10ms latency
                sync.addSample(offset(0, 10, 50));

                expect(sync.offsetMS).toBe(50);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(10);
                expect(sync.calculatedTimeLatencyMS).toBe(10);
                expect(sync.numIncludedSamples).toBe(1);
            });

            it('should be able to handle a non-zero server processing time', () => {
                // 10ms latency
                sync.addSample(offset(0, 10, 50, 32));

                expect(sync.offsetMS).toBe(50);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(10);
                expect(sync.calculatedTimeLatencyMS).toBe(10);
                expect(sync.numIncludedSamples).toBe(1);
            });

            it('should use multiple samples to calculate the time offset', () => {
                // 10ms latency + 25ms offset
                sync.addSample(offset(0, 10, 25));

                // 20ms latency + 25ms offset
                sync.addSample(offset(100, 20, 25));

                // 30ms latency + 25ms offset
                sync.addSample(offset(200, 30, 25));

                expect(sync.offsetMS).toBe(25);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(20);
                expect(sync.calculatedTimeLatencyMS).toBe(20);
                expect(sync.numIncludedSamples).toBe(3);
            });

            it('should support negative offsets', () => {
                // 10ms latency + -25ms offset
                sync.addSample(offset(0, 10, -25));

                // 20ms latency + -25ms offset
                sync.addSample(offset(100, 20, -25));

                // 30ms latency + -25ms offset
                sync.addSample(offset(200, 30, -25));

                expect(sync.offsetMS).toBe(-25);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.averageLatencyMS).toBe(20);
                expect(sync.calculatedTimeLatencyMS).toBe(20);
                expect(sync.numIncludedSamples).toBe(3);
            });
        });

        describe('variable latency', () => {

            it('should discard latency samples 1 standard deviation away from the median', () => {
                // 10ms latency + 25ms offset
                sync.addSample(offset(0, 10, 25));

                // 20ms latency + 25ms offset
                sync.addSample(offset(100, 20, 25));

                // 30ms latency + 25ms offset
                sync.addSample(offset(200, 30, 25));

                // 20ms latency + 25ms offset
                sync.addSample(offset(200, 20, 25));

                // 20ms latency + 25ms offset
                sync.addSample(offset(200, 20, 25));

                // 5ms latency + 25ms offset
                sync.addSample(offset(200, 5, 25));

                // 40ms latency + 25ms offset
                sync.addSample(offset(200, 40, 25));

                // 120ms latency + 25ms offset
                sync.addSample(offset(200, 120, 25));

                // 5ms + 10ms + 20ms + 20ms + 20ms + 30ms + 40ms + 120ms
                // 20ms is median
                // sample standard devation is 33.7363
                // so two samples get omitted (40ms and 120ms latency)

                expect(sync.offsetMS).toBe(25);
                expect(sync.offsetSpreadMS).toBe(0);
                expect(sync.calculatedTimeLatencyMS).toBeCloseTo(20.714, 2);
                expect(sync.numIncludedSamples).toBe(7);
                
                expect(sync.averageLatencyMS).toBe(33.125);
                expect(sync.totalLatencyMS).toBe(265);
                expect(sync.numTotalSamples).toBe(8);
            });

            it('should keep the 10 best latencies by default', () => {
                for(let i = 1; i <= 20; i++) {
                    // 10ms latency + 25ms offset
                    sync.addSample(offset(0, 10 * i, 25));
                }

                expect(sync.getSamples()).toEqual([
                    offset(0, 10, 25),
                    offset(0, 20, 25),
                    offset(0, 30, 25),
                    offset(0, 40, 25),
                    offset(0, 50, 25),
                    offset(0, 60, 25),
                    offset(0, 70, 25),
                    offset(0, 80, 25),
                    offset(0, 90, 25),
                    offset(0, 100, 25)
                ]);

                expect(sync.numIncludedSamples).toBe(6);
                expect(sync.numPreservedSamples).toBe(10);
                expect(sync.numTotalSamples).toBe(20);
            });

            it('should calculate the difference between the largest and smallest time offsets', () => {
                sync.addSample(offset(0, 10, 100));

                sync.addSample(offset(200, 120, 0));

                sync.addSample(offset(300, 45, 25));

                sync.addSample(offset(400, 35, 35));

                expect(sync.offsetSpreadMS).toBe(100);
            });
        });
    });

});

function offset(base: number, latency: number, offset: number, processingTime: number = 0) {
    return {
        clientRequestTime: base,
        serverReceiveTime: base + latency + offset,
        serverTransmitTime: base + latency + offset + processingTime,
        currentTime: base + (latency * 2) + processingTime
    };
}