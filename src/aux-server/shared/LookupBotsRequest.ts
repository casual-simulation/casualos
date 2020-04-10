import { TagFilter } from '@casual-simulation/aux-common';

export interface LookupBotsRequest {
    namespace: string;
    tags: TagFilter[];
}
