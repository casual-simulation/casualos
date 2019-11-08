import { Subject } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import {
    Actor,
    processConnections,
    processBranches,
    processActorBranches,
} from './CausalTreeServer2SocketIO';

describe('CausalTreeServer2', () => {
    let scheduler: TestScheduler;

    beforeEach(() => {
        scheduler = new TestScheduler((actual, expected) => {
            expect(actual).toEqual(expected);
        });
    });

    describe('processConnections()', () => {
        it('should issue a actor_connected event when an actor is added', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const a: Actor = {
                    id: 'test',
                };
                const devices = {
                    a: a,
                };
                const connected = cold('-a-|', devices);
                const disconnected = cold('---|', devices);

                const expected = '-a-|';
                const values = {
                    a: {
                        type: 'actor_connected',
                        actor: a,
                    },
                };

                const connectedSubs = '^--!';
                const disconnectedSubs = '^--!';

                const events = processConnections(connected, disconnected);

                expectObservable(events).toBe(expected, values);
                expectSubscriptions(connected.subscriptions).toBe(
                    connectedSubs
                );
                expectSubscriptions(disconnected.subscriptions).toBe(
                    disconnectedSubs
                );
            });
        });

        it('should issue a actor_disconnected event when an actor is removed', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const a: Actor = {
                    id: 'test',
                };
                const devices = {
                    a: a,
                };
                const connected = cold('---|', devices);
                const disconnected = cold('-a-|', devices);

                const expected = '-a-|';
                const values = {
                    a: {
                        type: 'actor_disconnected',
                        actor: a,
                    },
                };

                const connectedSubs = '^--!';
                const disconnectedSubs = '^--!';

                const events = processConnections(connected, disconnected);

                expectObservable(events).toBe(expected, values);
                expectSubscriptions(connected.subscriptions).toBe(
                    connectedSubs
                );
                expectSubscriptions(disconnected.subscriptions).toBe(
                    disconnectedSubs
                );
            });
        });
    });

    describe('processBranches()', () => {
        it('should issue a join_branch event when an actor joins a branch', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const actor: Actor = {
                    id: 'test',
                };
                const branches = {
                    a: 'test',
                };
                const join = cold('-a-|', branches);
                const leave = cold('---|', branches);

                const expected = '-a-|';
                const values = {
                    a: {
                        type: 'join_branch',
                        actor: actor,
                        branch: 'test',
                    },
                };

                const joinSubs = '^--!';
                const leaveSubs = '^--!';

                const events = processBranches(actor, join, leave);

                expectObservable(events).toBe(expected, values);
                expectSubscriptions(join.subscriptions).toBe(joinSubs);
                expectSubscriptions(leave.subscriptions).toBe(leaveSubs);
            });
        });

        it('should issue a leave_branch event when an actor leaves a branch', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const actor: Actor = {
                    id: 'test',
                };
                const branches = {
                    a: 'test',
                };
                const join = cold('---|', branches);
                const leave = cold('-a-|', branches);

                const expected = '-a-|';
                const values = {
                    a: {
                        type: 'leave_branch',
                        actor: actor,
                        branch: 'test',
                    },
                };

                const joinSubs = '^--!';
                const leaveSubs = '^--!';

                const events = processBranches(actor, join, leave);

                expectObservable(events).toBe(expected, values);
                expectSubscriptions(join.subscriptions).toBe(joinSubs);
                expectSubscriptions(leave.subscriptions).toBe(leaveSubs);
            });
        });
    });

    describe('processActorBranches()', () => {
        it('should subscribe to the created observables when an actor is added', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const a: Actor = {
                    id: 'test',
                };
                const devices = {
                    a: a,
                };
                const connected = cold('-a-|', devices);
                const disconnected = cold('---|', devices);

                const branches = {
                    a: 'test',
                };
                const joins = cold('--a-|', branches);
                const leaves = cold('----|', branches);

                const expected = '-a-b-|';
                const values = {
                    a: {
                        type: 'actor_connected',
                        actor: a,
                    },
                    b: {
                        type: 'join_branch',
                        actor: a,
                        branch: 'test',
                    },
                };

                const connectedSubs = '^--!';
                const disconnectedSubs = '^--!';
                const joinSubs = '-^---!';
                const leaveSubs = '-^---!';

                const events = processActorBranches(
                    connected,
                    disconnected,
                    actor => {
                        expect(actor).toEqual(a);
                        return {
                            join: joins,
                            leave: leaves,
                        };
                    }
                );

                expectObservable(events).toBe(expected, values);

                expectSubscriptions(connected.subscriptions).toBe(
                    connectedSubs
                );
                expectSubscriptions(disconnected.subscriptions).toBe(
                    disconnectedSubs
                );

                expectSubscriptions(joins.subscriptions).toBe(joinSubs);
                expectSubscriptions(leaves.subscriptions).toBe(leaveSubs);
            });
        });

        it('should unsubscribe from the branch subs when the device disconnects', () => {
            scheduler.run(helpers => {
                const { cold, expectObservable, expectSubscriptions } = helpers;

                const a: Actor = {
                    id: 'test',
                };
                const devices = {
                    a: a,
                };
                const connected = cold('-a---|', devices);
                const disconnected = cold('---a-|', devices);

                const branches = {
                    a: 'test',
                };
                const joins = cold('----|', branches);
                const leaves = cold('----|', branches);

                const expected = '-a-b---|';
                const values = {
                    a: {
                        type: 'actor_connected',
                        actor: a,
                    },
                    b: {
                        type: 'actor_disconnected',
                        actor: a,
                    },
                };

                const connectedSubs = '^----!';
                const disconnectedSubs = '^----!';
                const joinSubs = '-^--!';
                const leaveSubs = '-^--!';

                const events = processActorBranches(
                    connected,
                    disconnected,
                    actor => {
                        expect(actor).toEqual(a);
                        return {
                            join: joins,
                            leave: leaves,
                        };
                    }
                );

                expectObservable(events).toBe(expected, values);

                expectSubscriptions(connected.subscriptions).toBe(
                    connectedSubs
                );
                expectSubscriptions(disconnected.subscriptions).toBe(
                    disconnectedSubs
                );

                expectSubscriptions(joins.subscriptions).toBe(joinSubs);
                expectSubscriptions(leaves.subscriptions).toBe(leaveSubs);
            });
        });
    });
});
