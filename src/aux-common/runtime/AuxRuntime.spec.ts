import { MemoryPartition, createMemoryPartition } from '../partitions';
import { AuxRuntime } from './AuxRuntime';
import { BotAction } from '../bots';
import { botActionsTests } from '../bots/test/BotActionsTests';
import uuid from 'uuid/v4';
import { PrecalculationManager } from '.';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AuxRuntime', () => {
    let memory: MemoryPartition;
    let runtime: AuxRuntime;
    let events: BotAction[][];

    beforeEach(() => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        runtime = new AuxRuntime();

        events = [];

        // runtime.onActions.subscribe(a => events.push(a));
    });

    it('should pass', () => {});
    // botActionsTests(uuidMock, (state, action, library) => {
    //     const runtime = new AuxRuntime();
    //     const memory = createMemoryPartition({
    //         type: 'memory',
    //         initialState: {}
    //     });
    //     const precalc = new PrecalculationManager(() => memory.state, )
    //     // runtime.update({
    //     //     state: state,
    //     //     addedBots: [],
    //     //     removedBots: [],
    //     //     updatedBots: []
    //     // });
    //     return runtime.shout(action.eventName, action.botIds, action.argument);
    // });
});
