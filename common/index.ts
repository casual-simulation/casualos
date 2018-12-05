import { StoreFactory } from './channels-core';
import { FilesStateStore } from './FilesChannel';
import { UIStateStore } from './UIChannel';

export * from './File';
export * from './FilesChannel';
export * from './UIChannel';

export const storeFactory = new StoreFactory({
    files: () => new FilesStateStore({}),
    ui: () => new UIStateStore()
});

export const channelTypes = {
    ui: 'ui',
    files: 'files'
};