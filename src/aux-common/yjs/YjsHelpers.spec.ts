import {
    applyUpdate,
    createRelativePositionFromTypeIndex,
    Doc,
    encodeStateAsUpdate,
} from 'yjs';
import {
    createRelativePositionFromStateVector,
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
    });
});
