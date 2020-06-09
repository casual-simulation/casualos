import { AuxPartitionRealtimeEditModeProvider } from './AuxPartitionRealtimeEditModeProvider';
import { AuxPartitions } from './AuxPartition';
import { RealtimeEditMode } from '../runtime/RuntimeBot';
import { createMemoryPartition } from './MemoryPartition';
import { createBot } from '../bots/BotCalculations';
import { createBotClientPartition } from './BotPartition';
import { MemoryBotClient } from './MemoryBotClient';

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
        ])('%s', space => {
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
                partitions[space] = createBotClientPartition({
                    type: 'bot_client',
                    client: new MemoryBotClient(),
                    story: 'story',
                });
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

        it('should default to Immediate', () => {
            expect(subject.getEditMode('missing')).toEqual(
                RealtimeEditMode.Immediate
            );
        });
    });
});
