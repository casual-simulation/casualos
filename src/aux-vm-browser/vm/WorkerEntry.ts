import Worker from '../vm/AuxWorker';
import { setupWorker } from './WorkerEntryHelpers';

const instance = new Worker();

setupWorker(instance);
