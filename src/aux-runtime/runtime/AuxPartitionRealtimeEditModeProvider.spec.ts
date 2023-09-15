import { AuxPartitionRealtimeEditModeProvider } from './AuxPartitionRealtimeEditModeProvider';
import { RealtimeEditMode } from './RuntimeBot';
import {
    createBot,
    AuxPartitions,
    createMemoryPartition,
} from '@casual-simulation/aux-common';

describe('AuxPartitionRealtimeEditModeProvider', () => {
    let partitions: AuxPartitions;
    let subject: AuxPartitionRealtimeEditModeProvider;

    beforeEach(() => {
        partitions = <any>{};
        subject = new AuxPartitionRealtimeEditModeProvider(partitions);
    });

    describe('getEditMode()', () => {
        describe.each([
            'shared',
            'local',
            'tempLocal',
            'error',
            'history',
            'custom',
            'certified',
        ])('%s', (space) => {
            it('should return the edit mode for the given space', () => {
                partitions[space] = createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        abc: createBot('abc'),
                    },
                });
                expect(subject.getEditMode(space)).toEqual(
                    RealtimeEditMode.Immediate
                );
            });

            it('should be able to return delayed modes', () => {
                partitions[space] = {
                    realtimeStrategy: RealtimeEditMode.Delayed,
                } as any;
                expect(subject.getEditMode(space)).toEqual(
                    RealtimeEditMode.Delayed
                );
            });

            it('should support partitions which change their mode', () => {
                partitions[space] = <any>{
                    realtimeStrategy: 'immediate',
                };
                expect(subject.getEditMode(space)).toEqual(
                    RealtimeEditMode.Immediate
                );

                partitions[space].realtimeStrategy = 'delayed';
                expect(subject.getEditMode(space)).toEqual(
                    RealtimeEditMode.Delayed
                );
            });
        });

        it('should default certified to None', () => {
            expect(subject.getEditMode('certified')).toEqual(
                RealtimeEditMode.None
            );
        });

        it('should default bootstrap to None', () => {
            expect(subject.getEditMode('bootstrap')).toEqual(
                RealtimeEditMode.None
            );
        });

        it('should default to Immediate', () => {
            expect(subject.getEditMode('missing')).toEqual(
                RealtimeEditMode.Immediate
            );
        });
    });
});
