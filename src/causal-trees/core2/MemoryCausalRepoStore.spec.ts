import { MemoryCausalRepoStore } from './MemoryCausalRepoStore';
import causalRepoStoreTests from './test/CausalRepoStoreTests';

describe('MemoryCausalRepoStore', () => {
    causalRepoStoreTests(() => new MemoryCausalRepoStore());
});
