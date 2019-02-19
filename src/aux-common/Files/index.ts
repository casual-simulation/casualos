import { StoreFactory } from '../channels-core';
import { FilesStateStore } from './FilesChannel';

export * from './File';
export * from './FilesChannel';

export const storeFactory = new StoreFactory({
    files: () => new FilesStateStore({})
});

export const channelTypes = {
    files: 'files'
};