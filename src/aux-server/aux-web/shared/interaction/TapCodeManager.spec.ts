import { TapCodeManager } from "./TapCodeManager";


describe('TapCodeManager', () => {
    let manager: TapCodeManager;
    beforeEach(() => {
        manager = new TapCodeManager();
    });

    it('should record the max number of touches between periods of no touches', () => {
        manager.recordTouches(1);
        manager.recordTouches(4);
        manager.recordTouches(2);
        manager.recordTouches(0);

        expect(manager.code).toBe('4');
    });

    it('should record the code based on touches', () => {
        manager.recordTouches(1);
        manager.recordTouches(4);
        manager.recordTouches(2);
        manager.recordTouches(0);

        manager.recordTouches(1);
        manager.recordTouches(2);
        manager.recordTouches(0);
        manager.recordTouches(0);
        manager.recordTouches(0);
        manager.recordTouches(0);

        manager.recordTouches(1);
        manager.recordTouches(0);

        manager.recordTouches(99);
        manager.recordTouches(0);

        expect(manager.code).toBe('42199');
    });

    it('should allow resets', () => {
        manager.recordTouches(1);
        manager.recordTouches(4);
        manager.recordTouches(2);
        manager.recordTouches(0);

        manager.reset();

        expect(manager.code).toBe('');
    });

    it('should trim the code to the given length', () => {
        manager.recordTouches(1);
        manager.recordTouches(4);
        manager.recordTouches(2);
        manager.recordTouches(0);

        manager.recordTouches(1);
        manager.recordTouches(2);
        manager.recordTouches(0);
        manager.recordTouches(0);
        manager.recordTouches(0);
        manager.recordTouches(0);

        manager.recordTouches(1);
        manager.recordTouches(0);

        manager.recordTouches(9);
        manager.recordTouches(0);

        manager.recordTouches(5);
        manager.recordTouches(0);

        manager.trim(4);
        expect(manager.code).toBe('2195');
    });
});