import { getConnectionId } from './ConnectionIndicator';
import { formatV1ConnectionToken } from './ConnectionToken';

describe('getConnectionId()', () => {
    it('should return the connection ID from the given ID indicator', () => {
        expect(
            getConnectionId({
                connectionId: 'id',
            })
        ).toBe('id');
    });

    it('should return the connection ID from the given connection token', () => {
        expect(
            getConnectionId({
                connectionToken: formatV1ConnectionToken(
                    'userId',
                    'sessionId',
                    'connectionId',
                    'recordName',
                    'inst',
                    'hash'
                ),
            })
        ).toBe('connectionId');
    });
});
