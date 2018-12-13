import { Subject } from 'rxjs';
import { expect } from 'chai';
import { TestConnector } from '../test/TestConnector';
import { Event } from '../Event';
import { Reducer } from '../Reducer';
import { IChannel, Channel } from '../Channel';
import { ReducingStateStore } from '../StateStore';

describe('builtin', () => {
    describe('BaseConnector', () => {
        let channel: IChannel<number>;
        let serverEvents: Subject<Event>;
        let connector: TestConnector;
        let reducer = (state: number, event: Event) => {
            state = state || 0;
            if (event.type === 'add') {
                state += 1;
            } else if (event.type === 'subtract') {
                state -= 1;
            }
            return state;
        };
        let store = new ReducingStateStore(0, reducer);

        function init(state?: number) {
            serverEvents = new Subject<Event>();
            connector = new TestConnector(state, serverEvents);
            channel = new Channel<number>({
                id: 'abc',
                name: 'test',
                type: 'custom'
            }, connector, store);
        }

        it('should return info used to connect', () => {
            init();

            return channel.subscribe().then(connection => {
                expect(connection).to.not.be.null;
                expect(connection.info.id).to.equal('abc');
                expect(connection.info.name).to.equal('test');
                expect(connection.info.type).to.equal('custom');
            });
        });

        it('should return store used to connect', () => {
            init();

            return channel.subscribe().then(connection => {
                expect(connection).to.not.be.null;
                expect(connection.store).to.equal(store);
            });
        });

        it('should pass server events through events() observable.', () => {
            init();

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);

                let events: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));

                serverEvents.next({
                    type: 'add',
                    creation_time: new Date()
                });

                serverEvents.next({
                    type: 'add',
                    creation_time: new Date()
                });

                serverEvents.next({
                    type: 'subtract',
                    creation_time: new Date()
                });

                expect(events.length).to.equal(3);
                expect(events[0]).to.include({
                    type: 'add'
                });
                expect(events[1]).to.include({
                    type: 'add'
                });
                expect(events[2]).to.include({
                    type: 'subtract'
                });

                sub.unsubscribe();
            });
        });

        it('should pass client events through events() observable.', () => {
            init(0);

            return channel.subscribe().then(connection => {
                let store = connection.store;

                expect(store.state()).to.equal(0);

                let events: Event[] = [];
                let sub = connection.events.subscribe(e => events.push(e));

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                connection.emit({
                    type: 'add',
                    creation_time: new Date()
                });

                connection.emit({
                    type: 'subtract',
                    creation_time: new Date()
                });

                expect(events.length).to.equal(3);
                expect(events[0]).to.include({
                    type: 'add'
                });
                expect(events[1]).to.include({
                    type: 'add'
                });
                expect(events[2]).to.include({
                    type: 'subtract'
                });

                sub.unsubscribe();
            });
        });
    });
});