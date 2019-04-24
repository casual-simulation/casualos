import FilePanelManager from './FilePanelManager';

describe('FilePanelManager', () => {
    describe('isOpen', () => {
        it('should be closed by default', () => {
            let manager = new FilePanelManager();

            expect(manager.isOpen).toBe(false);
        });

        it('should send an event when the panel gets toggled open', () => {
            let manager = new FilePanelManager();

            let changes: boolean[] = [];
            manager.isOpenChanged.subscribe(c => changes.push(c));

            expect(changes).toEqual([false]);

            manager.toggleOpen();
            manager.toggleOpen();

            expect(changes).toEqual([false, true, false]);
        });
    });
});
