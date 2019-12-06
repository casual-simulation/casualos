import { propertyInsertText } from './CompletionHelpers';

describe('CompletionHelpers', () => {
    describe('propertyInsertText()', () => {
        it('should return the property if it is alphanumeric', () => {
            expect(propertyInsertText('abc')).toEqual('.abc');
            expect(propertyInsertText('a123')).toEqual('.a123');
            expect(propertyInsertText('a_b_c')).toEqual('.a_b_c');
            expect(propertyInsertText('_1')).toEqual('._1');
        });

        it('should return the property with brackets if it is not alphanumeric', () => {
            expect(propertyInsertText('1abc')).toEqual('["1abc"]');
            expect(propertyInsertText('test.tag')).toEqual('["test.tag"]');
            expect(propertyInsertText('@fun')).toEqual('["@fun"]');
        });
    });
});
