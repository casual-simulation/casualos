import { getInstParameters, getPermalink } from './UrlUtils';

describe('getInstParameters()', () => {
    it('should return null if no inst options could be resolved', () => {
        const params = getInstParameters({ ab: 'test' });
        expect(params).toEqual(null);
    });

    it('should use the owner parameter', () => {
        const params = getInstParameters({
            inst: 'test',
            owner: 'testRecord',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: 'testRecord',
            owner: 'testRecord',
            isStatic: false,
        });
    });

    it('should return the inst and record', () => {
        const params = getInstParameters({
            inst: 'test',
            record: 'testRecord',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: 'testRecord',
            owner: null,
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
            owner: null,
            isStatic: false,
        });
    });

    it('should support public insts', () => {
        const params = getInstParameters({ inst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: false,
        });
    });

    it('should support the story param', () => {
        const params = getInstParameters({ story: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: false,
            story: true,
        });
    });

    it('should support the server param', () => {
        const params = getInstParameters({ server: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: false,
            server: true,
        });
    });

    it('should support static insts', () => {
        const params = getInstParameters({ staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: true,
        });
    });

    it('should prefer static insts', () => {
        const params = getInstParameters({ inst: 'abc', staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: true,
        });
    });

    it('should not support deleting insts (with inst=)', () => {
        const params = getInstParameters({
            bios: 'delete inst',
            inst: 'test',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: false,
        });
    });

    it('should not support deleting insts (with staticInst=)', () => {
        const params = getInstParameters({
            bios: 'delete inst',
            staticInst: 'test',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            isStatic: true,
        });
    });
});

describe('getPermalink()', () => {
    it('should add the given record name to the URL', () => {
        const url = getPermalink('https://test.com', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should do nothing if the record name is null', () => {
        const url = getPermalink('https://test.com', null);
        expect(url).toEqual('https://test.com/');
    });

    it('should remove the owner if the record name is null', () => {
        const url = getPermalink('https://test.com?owner=test', null);
        expect(url).toEqual('https://test.com/');
    });

    it('should overwrite the owner on the URL with the record name', () => {
        const url = getPermalink('https://test.com?owner=test', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should preserve the owner if the owner is public and the recordName is null', () => {
        const url = getPermalink('https://test.com?owner=public', null);
        expect(url).toEqual('https://test.com/?owner=public');
    });

    it('should remove the record query parameter', () => {
        const url = getPermalink('https://test.com?record=other', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should remove the player query parameter', () => {
        const url = getPermalink('https://test.com?player=other', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });
});
