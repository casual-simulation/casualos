export type DirectoryResult =
    | QueryResult
    | EntryUpdatedResult
    | NotAuthorizedResult;

export interface QueryResult {
    type: 'query_results';
    entries: DirectoryInfo[];
}

export interface DirectoryInfo {
    publicName: string;
    subhost: string;
}

export interface EntryUpdatedResult {
    type: 'entry_updated';
    token: string;
}

export interface NotAuthorizedResult {
    type: 'not_authorized';
}
