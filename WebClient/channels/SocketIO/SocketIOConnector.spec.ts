import { expect } from 'chai';
import { mock, match, SinonMock } from 'sinon';
import { SocketIOConnector } from './SocketIOConnector';
import { Event, ChannelInfo } from '../../../common/channels-core';
import { ReducingStateStore } from '../../../common/channels-core/StateStore';

describe('Socket.IO', () => {
    describe('SocketIOConnector', () => {

        describe('unit', () => {

            let socketIOApi = {
                emit: function () { },
                on: function () { },
                off: function () { }
            };

            let socketIOMock: SinonMock;
            let connector: SocketIOConnector;
            let info: ChannelInfo = {
                id: 'abc',
                type: 'custom',
                name: 'test'
            };
            let eventName = `new_event_${info.id}`;
            let reducer = (state: number, event: Event) => {
                state = state || 0;
                if (event.type === 'add') {
                    state += 1;
                } else if (event.type === 'subtract') {
                    state -= 1;
                }
                return state;
            };
            let store = new ReducingStateStore<number>(0, reducer);
            function init() {
                socketIOMock = mock(socketIOApi);
                connector = new SocketIOConnector(<any>socketIOApi);
            }

            it('should emit a "join_server" call', () => {
                init();

                socketIOMock.expects('emit').once()
                    .withArgs('join_server', info, match.func);

                connector.connectToChannel({
                    info: info,
                    store: store
                });

                socketIOMock.verify();
            });

            it('should start listening to the "new_event" event', () => {
                init();

                let joinServer = socketIOMock.expects('emit').once()
                    .withArgs('join_server', info, match.func);

                socketIOMock.expects('on').once()
                    .withArgs(eventName, match.func);

                socketIOMock.expects('emit').once()
                    .withArgs('leave_server', info.id, match.func);

                socketIOMock.expects('off').once()
                    .withArgs(eventName, match.func);

                let promise = connector.connectToChannel({
                    info: info,
                    store: store
                });

                // Call the join_server callback
                joinServer.callArgWith(2, null, info, 5)

                return promise.then(connection => {
                    expect(connection.store.state()).to.equal(5);
                    let sub = connection.events.subscribe(e => {

                    });
                    sub.unsubscribe();

                    // Call the leave_server callback
                    connection.unsubscribe();
                    socketIOMock.verify();
                });
            });

            it('should emit events with the "new_event" event name', () => {
                init();

                let event: Event = {
                    type: 'test',
                    creation_time: new Date()
                };
                let emit = socketIOMock.expects('emit').once()
                    .withArgs('join_server', info, match.func);

                socketIOMock.expects('emit').once()
                    .withArgs(eventName, event);

                let promise = connector.connectToChannel({
                    info: info,
                    store: store
                });

                emit.callArgWith(2, null, info, {})

                return promise.then(response => {
                    response.emit(event);
                    socketIOMock.verify();
                });
            });
        });
    });
});
