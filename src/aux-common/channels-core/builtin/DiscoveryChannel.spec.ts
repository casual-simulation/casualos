import { expect } from 'chai';
import { Channel, ChannelInfo, IChannel } from '../Channel';
import { DiscoveryChannelInfo, channelCreated, channelRemoved, createDiscoveryChannelStateStore } from './DiscoveryChannel';
import { TestConnector } from '../test/TestConnector';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Event } from '../Event';

describe('builtin', () => {
    describe('DiscoveryChannel', () => {

        let channel: IChannel<ChannelInfo[]>;
        let connector: TestConnector;
        let serverEvents: Subject<Event>;

        function init(state?: ChannelInfo[]) {
            serverEvents = new Subject<Event>();
            connector = new TestConnector(state, serverEvents);
            channel = new Channel<ChannelInfo[]>(DiscoveryChannelInfo, connector, createDiscoveryChannelStateStore());
        }

        it('channel_created events should be added to state', () => {
            init();

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.be.empty;

                connection.emit(channelCreated({
                    id: 'abc',
                    name: 'def',
                    type: 'custom'
                }));

                expect(store.state()).to.eql([
                    {
                        id: 'abc',
                        name: 'def',
                        type: 'custom'
                    }
                ]);
            });
        });

        it('channel_removed events should be removed from state', () => {
            init([
                {
                    id: 'abc',
                    name: 'def',
                    type: 'custom'
                }
            ]);

            return channel.subscribe().then(connection => {
                let store = connection.store;
                
                expect(store.state()).to.not.be.null.and.not.empty;

                connection.emit(channelRemoved('abc'));

                expect(store.state()).to.eql([]);
            });
        });

        it('server channel_created events should be added to state', () => {
            init();

            return channel.subscribe().then(connection => {
                let store = connection.store;
                
                expect(store.state()).to.be.empty;

                serverEvents.next(channelCreated({
                    id: 'abc',
                    name: 'def',
                    type: 'custom'
                }));

                expect(store.state()).to.eql([
                    {
                        id: 'abc',
                        name: 'def',
                        type: 'custom'
                    }
                ]);
            });
        });

        it('server channel_removed events should be removed from state', () => {
            init([
                {
                    id: 'abc',
                    name: 'def',
                    type: 'custom'
                }
            ]);

            return channel.subscribe().then(connection => {
                let store = connection.store;
                
                expect(store.state()).to.not.be.null.and.not.empty;

                serverEvents.next(channelRemoved('abc'));

                expect(store.state()).to.eql([]);
            });
        });
    });
});