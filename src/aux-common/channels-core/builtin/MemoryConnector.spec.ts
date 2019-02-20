import {expect} from 'chai';
import { MemoryConnector } from "./MemoryConnector";
import { StateStore, ReducingStateStore } from "../StateStore";
import { ChannelInfo } from "../ChannelInfo";
import { Event } from '../Event';

describe('builtin', () => {
    describe('MemoryConnector', () => {
        let connector: MemoryConnector;
        let store: StateStore<number>;
        let info: ChannelInfo;
        let reducer = (state: number, event: Event) => {
            state = state || 0;
            if (event.type === 'add') {
                state += 1;
            } else if (event.type === 'subtract') {
                state -= 1;
            }
            return state;
        };
        beforeEach(() => {
            info = {
                id: 'abc',
                name: 'test',
                type: 'custom'
            };
            store = new ReducingStateStore(0, reducer);
            connector = new MemoryConnector();
        });

        it('should allow connections to new channels', () => {
            return connector.connectToChannel({
                info: info,
                store: store
            }).then(connection => {
                expect(connection).to.not.be.null;
            });
        });

        it('should return the same connection for the same channel ID', () => {
            return connector.connectToChannel({
                info: info,
                store: store
            }).then(connectionA => {
                expect(connectionA).to.not.be.null;

                return connector.connectToChannel({
                    info: {
                        id: 'abc',
                        name: 'other_name',
                        type: 'other_type'
                    },
                    store: new ReducingStateStore(0, reducer)
                }).then(connectionB => {
                    expect(connectionB).to.equal(connectionA);
                });
            });
        });

        it('should send events to the store', () => {
            return connector.connectToChannel({
                info: info,
                store: store
            }).then(connection => {
                connection.emit({
                    creation_time: new Date(),
                    type: 'add'
                });

                let state = store.state();

                expect(state).to.equal(1);
            });
        });

        it('should preserve the store state', () => {
            store.process({
                creation_time: new Date(),
                type: 'add'
            });
            store.process({
                creation_time: new Date(),
                type: 'add'
            });

            return connector.connectToChannel({
                info: info,
                store: store
            }).then(connection => {
                let state = store.state();
                expect(state).to.equal(2);
            });
        });
    });
});