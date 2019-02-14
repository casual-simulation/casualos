import { VirtualArray } from "./VirtualArray";

describe('VirtualArray', () => {
    describe('get()', () => {
        it('should get the value from the internal array at the offset', () => {
            let arr: number[] = [1, 2, 3];

            let a = new VirtualArray(arr, 1);
            expect(a.length).toBe(2);

            expect(a.get(0)).toBe(2);
            expect(a.get(1)).toBe(3);

            expect(() => a.get(2)).toThrow();
            expect(() => a.get(-1)).toThrow();
        });
    });

    describe('set()', () => {
        it('should set the value at the index', () => {
            let arr: number[] = [1, 2, 3];

            let a = new VirtualArray(arr, 1);
            expect(a.length).toBe(2);

            a.set(0, 5);
            a.set(1, 9)
            expect(a.get(0)).toBe(5);
            expect(arr[1]).toBe(5);
            expect(a.get(1)).toBe(9);
            expect(arr[2]).toBe(9);

            expect(() => a.set(2, 4)).toThrow();
            expect(() => a.set(-1, 5)).toThrow();
        });
    });

    describe('insert()', () => {
        it('should insert the value at the index', () => {
            let arr: number[] = [1, 2, 3];

            let a = new VirtualArray(arr, 1);
            expect(a.length).toBe(2);

            a.insert(0, 5);
            a.insert(3, 10);
            expect(a.length).toBe(4);
            expect(arr.length).toBe(5);
            
            expect(a.get(0)).toBe(5);
            expect(a.get(1)).toBe(2);
            expect(a.get(2)).toBe(3);
            expect(a.get(3)).toBe(10);

            expect(arr[0]).toBe(1);
            expect(arr[1]).toBe(5);
            expect(arr[2]).toBe(2);
            expect(arr[3]).toBe(3);
            expect(arr[4]).toBe(10);
        });

        it('should handle arrays with 0 length', () => {
            let arr: number[] = [1, 2, 3];

            let a = new VirtualArray(arr, 0, 0);
            expect(a.length).toBe(0);

            a.insert(0, 5);
            expect(a.length).toBe(1);
            expect(arr.length).toBe(4);
            
            expect(a.get(0)).toBe(5);

            expect(arr[0]).toBe(5);
            expect(arr[1]).toBe(1);
            expect(arr[2]).toBe(2);
            expect(arr[3]).toBe(3);
        });
    });

    describe('remove()', () => {
        it('should remove the value at the index', () => {
            let arr: number[] = [1, 2, 3];

            let a = new VirtualArray(arr, 1);
            expect(a.length).toBe(2);

            expect(a.remove(1)).toBe(3);

            expect(a.length).toBe(1);
            expect(arr.length).toBe(2);
            
            expect(a.get(0)).toBe(2);

            expect(arr[0]).toBe(1);
            expect(arr[1]).toBe(2);
        });
    });
});