/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { AuxPartitionRealtimeEditModeProvider } from './AuxPartitionRealtimeEditModeProvider';
import { RealtimeEditMode } from './RuntimeBot';
import type { AuxPartitions } from '@casual-simulation/aux-common';
import {
    createBot,
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
