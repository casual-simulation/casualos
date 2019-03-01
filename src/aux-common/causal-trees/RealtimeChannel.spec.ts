import { TestChannelConnection } from './test/TestChannelConnection';
import { RealtimeChannelConnection } from "./RealtimeChannelConnection";
import { RealtimeChannel } from "./RealtimeChannel";
import { site } from './SiteIdInfo';
import { SiteVersionInfo } from './SiteVersionInfo';

describe('RealtimeChannel', () => {
    let connection: TestChannelConnection;
    let channel: RealtimeChannel<number>;
    beforeEach(() => {
        connection = new TestChannelConnection();
        channel = new RealtimeChannel({
            id: 'abc',
            type: 'numbers'
        }, connection);
    })

    describe('constructor()', () => {
        it('should register the known event names with the connection', async () => {
            expect(connection.knownEventNames).toContain('event_abc');
            expect(connection.knownEventNames).toContain('info_abc');
            expect(connection.knownEventNames).toContain('siteId_abc');
        });
    });

    describe('events', () => {
        it('should resolve with emit events from the connection', () => {
            let events: any[] = [];
            channel.events.subscribe(e => events.push(e));

            const eventA = {};
            const eventB = {
                some: 'event'
            };
            const eventC = {
                some: 'other'
            };

            connection.events.next({
                name: 'event_abc',
                data: eventA
            });

            connection.events.next({
                name: 'event_abc',
                data: eventB
            });

            connection.events.next({
                name: 'some_random_event',
                data: eventC
            });

            expect(events).toEqual([
                eventA,
                eventB
            ]);
        });

        it('should emit events to the connection', () => {
            channel.emit(201);
            channel.emit(99);
            channel.emit(-12);

            expect(connection.emitted).toEqual([
                { name: 'event_abc', data: 201 },
                { name: 'event_abc', data: 99 },
                { name: 'event_abc', data: -12 }
            ]);
        });
    });

    describe('exchangeInfo()', () => {
        it('should make a request using the given info', async () => {

            const promise = channel.exchangeInfo({
                site: site(1),
                knownSites: null,
                version: null
            });

            expect(connection.requests[0]).toMatchObject({
                name: 'info_abc',
                data: {
                    site: site(1),
                    knownSites: null,
                    version: null
                }
            });

            const returned: SiteVersionInfo = {
                site: site(2),
                knownSites: null,
                version: null
            };
            connection.requests[0].resolve(returned);

            const result = await promise;

            expect(result).toBe(returned);
        });
    });

    describe('requestSiteId', () => {
        it('should make a request using the given data', async () => {
            const promise = channel.requestSiteId(site(1));

            expect(connection.requests[0]).toMatchObject({
                name: 'siteId_abc',
                data: site(1)
            });

            const returned = false;
            connection.requests[0].resolve(returned);

            const result = await promise;

            expect(result).toBe(returned);
        });
    });

    describe('join_channel', () => {
        it('should emit join request when we become connected', () => {

            connection.setConnected(true);

            // Channel should emit join event

            expect(connection.requests.length).toBe(1);
            expect(connection.requests[0].name).toEqual('join_channel');
            expect(connection.requests[0].data).toEqual({
                id: 'abc',
                type: 'numbers'
            });
        });

        it('should emit the join event again after going offline and back online', () => {
            connection.setConnected(true);
            connection.setConnected(false);
            connection.setConnected(true);

            expect(connection.requests.length).toBe(2);
            expect(connection.requests[0].name).toEqual('join_channel');
            expect(connection.requests[0].data).toEqual({
                id: 'abc',
                type: 'numbers'
            });
            expect(connection.requests[1].name).toEqual('join_channel');
            expect(connection.requests[1].data).toEqual({
                id: 'abc',
                type: 'numbers'
            });
        });
    });
});