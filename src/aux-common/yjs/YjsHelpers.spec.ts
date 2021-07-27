import { first } from '@casual-simulation/causal-trees';
import {
    applyUpdate,
    createRelativePositionFromTypeIndex,
    Doc,
    encodeStateAsUpdate,
    Transaction,
    YTextEvent,
} from 'yjs';
import {
    createRelativePositionFromStateVector,
    getClock,
    getStateVector,
} from './YjsHelpers';

describe('YjsHelpers', () => {
    describe('getStateVector()', () => {
        it('should return the default state vector for a document', () => {
            const doc1 = new Doc();

            const vector = getStateVector(doc1);

            expect(vector).toEqual({});
        });

        it('should return the client ID mapped to the timestamp', () => {
            const doc1 = new Doc();
            const map1 = doc1.getMap();
            map1.set('abc', 'def');

            const vector = getStateVector(doc1);

            expect(vector).toEqual({
                [doc1.clientID]: 1,
            });
        });

        it('should include the correct timestamp for docs that contain strings', () => {
            const doc1 = new Doc();
            const text1 = doc1.getText();
            text1.insert(0, 'abcdef');

            const vector = getStateVector(doc1);

            expect(vector).toEqual({
                [doc1.clientID]: 6,
            });
        });

        it('should include timestamps for other clients', () => {
            const doc1 = new Doc();
            const doc2 = new Doc();
            const map1 = doc1.getMap();
            map1.set('abc', 'def');

            const map2 = doc2.getMap();
            map2.set('def', 123);

            const state1 = encodeStateAsUpdate(doc1);
            const state2 = encodeStateAsUpdate(doc2);

            applyUpdate(doc1, state2);
            applyUpdate(doc2, state1);

            const vector1 = getStateVector(doc1);
            const vector2 = getStateVector(doc2);

            expect(vector1).toEqual({
                [doc1.clientID]: 1,
                [doc2.clientID]: 1,
            });
            expect(vector2).toEqual({
                [doc1.clientID]: 1,
                [doc2.clientID]: 1,
            });
        });
    });

    describe('getClock()', () => {
        it('should return the default clock for a document', () => {
            const doc1 = new Doc();

            const clock = getClock(doc1, doc1.clientID);

            expect(clock).toEqual(undefined);
        });

        it('should return the client ID mapped to the timestamp', () => {
            const doc1 = new Doc();
            const map1 = doc1.getMap();
            map1.set('abc', 'def');

            const clock = getClock(doc1, doc1.clientID);

            expect(clock).toEqual(1);
        });

        it('should include the correct timestamp for docs that contain strings', () => {
            const doc1 = new Doc();
            const text1 = doc1.getText();
            text1.insert(0, 'abcdef');

            const clock = getClock(doc1, doc1.clientID);

            expect(clock).toEqual(6);
        });

        it('should include timestamps for other clients', () => {
            const doc1 = new Doc();
            const doc2 = new Doc();
            const map1 = doc1.getMap();
            map1.set('abc', 'def');

            const map2 = doc2.getMap();
            map2.set('def', 123);

            const state1 = encodeStateAsUpdate(doc1);
            const state2 = encodeStateAsUpdate(doc2);

            applyUpdate(doc1, state2);
            applyUpdate(doc2, state1);

            const clock1 = getClock(doc1, doc2.clientID);
            const clock2 = getClock(doc2, doc1.clientID);

            expect(clock1).toEqual(1);
            expect(clock2).toEqual(1);
        });
    });

    describe('createRelativePositionFromStateVector()', () => {
        it('should create a relative position at the given index with the given state vector', () => {
            const doc1 = new Doc();
            doc1.clientID = 1;
            const doc2 = new Doc();
            doc2.clientID = 2;
            const text1 = doc1.getText();
            const text2 = doc2.getText();
            text1.insert(0, 'abcdef');
            text2.insert(0, 'ghijfk');

            const vector1 = getStateVector(doc1);
            const vector2 = getStateVector(doc2);

            const state1 = encodeStateAsUpdate(doc1);
            const state2 = encodeStateAsUpdate(doc2);

            applyUpdate(doc1, state2);
            applyUpdate(doc2, state1);

            expect(text1.toString()).toEqual('abcdefghijfk');
            expect(text2.toString()).toEqual('abcdefghijfk');

            const pos1 = createRelativePositionFromStateVector(
                text1,
                vector1,
                2
            );
            const pos2 = createRelativePositionFromStateVector(
                text2,
                vector2,
                2
            );
            const expected1 = createRelativePositionFromTypeIndex(text1, 2);
            const expected2 = createRelativePositionFromTypeIndex(text2, 8);

            expect(pos1).toEqual(expected1);
            expect(pos2).toEqual(expected2);
        });

        it('should correctly handle concatenated inserts', () => {
            const doc1 = new Doc();
            doc1.clientID = 1;
            const text1 = doc1.getText();
            text1.insert(0, 'abc');
            const vector1 = getStateVector(doc1);

            text1.insert(6, 'ghi');

            expect(text1.toString()).toEqual('abcghi');

            // should be at the end of the string when it was "abc",
            // so it should stick to there.
            const pos1 = createRelativePositionFromStateVector(
                text1,
                vector1,
                3
            );

            const expected1 = createRelativePositionFromTypeIndex(text1, 3);

            expect(pos1).toEqual(expected1);
        });

        it('should be able to find a position in deleted text', () => {
            const doc1 = new Doc();
            doc1.clientID = 1;
            const doc2 = new Doc();
            doc2.clientID = 2;
            const text1 = doc1.getText();
            const text2 = doc2.getText();
            text1.insert(0, 'abcdef');
            text2.insert(0, 'ghijfk');

            const vector1 = getStateVector(doc1);
            const vector2 = getStateVector(doc2);

            const state1 = encodeStateAsUpdate(doc1);
            const state2 = encodeStateAsUpdate(doc2);

            applyUpdate(doc1, state2);
            applyUpdate(doc2, state1);

            expect(text1.toString()).toEqual('abcdefghijfk');
            expect(text2.toString()).toEqual('abcdefghijfk');

            text2.delete(0, 3);

            const state3 = encodeStateAsUpdate(doc2);
            applyUpdate(doc1, state3);

            const pos1 = createRelativePositionFromStateVector(
                text1,
                vector1,
                2,
                undefined,
                true
            );

            expect(pos1.item).toEqual({
                client: 1,
                clock: 2,
            });
        });
    });

    describe('yjs', () => {
        it('should support making edits with different client IDs', () => {
            let doc = new Doc();
            doc.clientID = 1;

            const text1 = doc.getText();
            let transaction: Transaction;
            doc.transact((t) => {
                transaction = t;

                text1.insert(0, 'abc');

                doc.clientID = 2;

                text1.insert(0, 'ghi');

                doc.clientID = 1;

                text1.insert(3, 'def');
            });

            expect(text1.toString()).toEqual('ghidefabc');

            let ids = [] as any;

            let item = text1._first;
            while (item) {
                ids.push({
                    ...item.id,
                    content: item.content.getContent(),
                });
                item = item.next;
            }

            expect(ids).toEqual([
                { client: 2, clock: 0, content: ['g', 'h', 'i'] },
                { client: 1, clock: 3, content: ['d', 'e', 'f'] },
                { client: 1, clock: 0, content: ['a', 'b', 'c'] },
            ]);

            expect(transaction.changedParentTypes.size).toBe(1);
            let events = first(transaction.changedParentTypes.values());
            expect(events.length).toBe(1);
            const event: YTextEvent = events[0] as YTextEvent;
            expect(event).toBeInstanceOf(YTextEvent);
            expect(event.changes.delta).toEqual([
                {
                    insert: 'ghidefabc',
                },
            ]);

            const version = getStateVector(doc);
            expect(version).toEqual({
                '1': 6,
                '2': 3,
            });
        });
    });
});
