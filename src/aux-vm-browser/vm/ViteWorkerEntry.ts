import Worker from './AuxChannel.worker?worker&inline';
import { setupWorker } from './WorkerEntryHelpers';

const instance = new Worker();

setupWorker(instance);
