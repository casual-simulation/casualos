import { expect } from 'chai';
import { StoreFactory } from "./StoreFactory";

describe('builtin', () => {
    describe('StoreFactory', () => {
        it('should map types to given factory functions', () => {
            let factory = new StoreFactory({
                custom: () => <any>0
            });

            let store = factory.create<number>({
                id: 'abc',
                type: 'custom',
                name: 'Name'
            });

            expect(store).to.equal(0);
        });

        it('should throw an error for types which don\'t exist', () => {
            let factory = new StoreFactory({
                custom: () => <any>0
            });

            expect(() => {
                factory.create<number>({
                    id: 'abc',
                    type: 'doesnt_exist',
                    name: 'Name'
                });
            }).to.throw;
        });
    });
});