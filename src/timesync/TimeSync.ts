import { sortedIndexBy } from 'lodash';


/**
 * Defines a class that can calculate the latency and offset between two clocks.
 * Works by using a sampling technique to determine the latency between two devices and therefore the clock offset.
 */
export class TimeSync {
    
    offsetMS: number = NaN;
    calculatedTimeLatencyMS: number = 0;
    averageLatencyMS: number = 0;

    numIncludedSamples: number = 0;
    numPreservedSamples: number = 0;
    numTotalSamples: number = 0;
    totalLatencyMS: number = 0;

    private _sampleStandardDeviation: number = NaN;
    private _samples: TimeSampleNode[] = [];
    private _maxIncludedSamples: number = 10;
    private _minSamplesForStandardDeviation = 5;

    constructor() {}

    /**
     * Adds the given sample for use in synchronization.
     * @param sample The sample.
     */
    addSample(sample: TimeSample) {
        const roundTripTime = (sample.currentTime - sample.clientRequestTime) - (sample.serverTransmitTime - sample.serverReceiveTime);
        const sampleLatency = roundTripTime / 2;

        this.numTotalSamples += 1;
        this.totalLatencyMS += sampleLatency;
        this.averageLatencyMS = this.totalLatencyMS / this.numTotalSamples;
        
        const sampleOffset = sample.serverTransmitTime - sample.currentTime + sampleLatency;
        const value: TimeSampleNode = {
            ...sample,
            latency: sampleLatency,
            offset: sampleOffset
        };
        const insertIndex = sortedIndexBy(this._samples, value, v => v.latency);

        if (insertIndex >= this._samples.length && this._samples.length >= this._maxIncludedSamples) {
            // Should not add the sample at the end
            // since that means it has the highest latency and it shouldn't be included because of the
            // included samples limit.
            return;
        }

        this._samples.splice(insertIndex, 0, value);
        if (this._samples.length > this._maxIncludedSamples) {
            this._samples.pop();
        }
        this.numPreservedSamples = this._samples.length;

        if (this._samples.length >= this._minSamplesForStandardDeviation) {
            let sampleDeviations = 0;
            for(let sample of this._samples) {
                const deviation = sample.latency - this.averageLatencyMS;
                sampleDeviations += deviation * deviation;
            }

            this._sampleStandardDeviation = Math.sqrt(sampleDeviations / (this._samples.length - 1));
        }
        
        let includedSamples = 0;
        let sumOfSampleOffsets = 0;
        let sumOfSampleLatencies = 0;
        const standardDeviation = this._sampleStandardDeviation;
        for (let sample of this._samples) {
            if (isNaN(standardDeviation) || Math.abs(this.averageLatencyMS - sample.latency) < standardDeviation) {
                includedSamples += 1;
                sumOfSampleOffsets += sample.offset;
                sumOfSampleLatencies += sample.latency;
            }
        }
        this.numIncludedSamples = includedSamples;

        if (includedSamples > 0) {
            this.offsetMS = sumOfSampleOffsets / includedSamples;
            this.calculatedTimeLatencyMS = sumOfSampleLatencies / includedSamples;
        } else {
            this.offsetMS = NaN;
            this.calculatedTimeLatencyMS = NaN;
        }
    }

    /**
     * Gets the list of samples that have been kept.
     */
    getSamples(): TimeSample[] {
        return this._samples.map(s => ({
            clientRequestTime: s.clientRequestTime,
            serverReceiveTime: s.serverReceiveTime,
            serverTransmitTime: s.serverTransmitTime,
            currentTime: s.currentTime,
        }));
    }

}


/**
 * Defines an interface for objects that represent a time sample.
 */
export interface TimeSample {
    clientRequestTime: number;
    serverReceiveTime: number;
    serverTransmitTime: number;
    currentTime: number;
}

export interface TimeSampleNode extends TimeSample {
    latency: number;
    offset: number;
}