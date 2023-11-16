import { getInstParameters } from './UrlUtils';

describe('getInstParameters()', () => {
    it('should return null if no inst options could be resolved', () => {
        const params = getInstParameters({ ab: 'test' });
        expect(params).toEqual(null);
    });

    it('should return the inst and record', () => {
        const params = getInstParameters({
            inst: 'test',
            record: 'testRecord',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: 'testRecord',
            isStatic: false,
        });
    });

    it('should support multiple insts', () => {
        const params = getInstParameters({
            inst: ['test', 'abc'],
            record: 'testRecord',
        });
        expect(params).toEqual({
            inst: ['test', 'abc'],
            recordName: 'testRecord',
            isStatic: false,
        });
    });

    it('should support public insts', () => {
        const params = getInstParameters({ inst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            isStatic: false,
        });
    });

    it('should support the story param', () => {
        const params = getInstParameters({ story: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            isStatic: false,
            story: true,
        });
    });

    it('should support the server param', () => {
        const params = getInstParameters({ server: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            isStatic: false,
            server: true,
        });
    });

    it('should support static insts', () => {
        const params = getInstParameters({ staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            isStatic: true,
        });
    });

    it('should prefer static insts', () => {
        const params = getInstParameters({ inst: 'abc', staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            isStatic: true,
        });
    });
});
