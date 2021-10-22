import Worker from './AuxChannel.worker?worker';
import { setupWorker } from './WorkerEntryHelpers';

const instance = new Worker();

setupWorker(instance);
