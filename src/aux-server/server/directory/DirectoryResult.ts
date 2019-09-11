export type DirectoryResult =
    | QueryResult
    | EntryUpdatedResult
    | NotAuthorizedResult
    | BadRequestResult;

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
    privateKey: string;
}

export interface NotAuthorizedResult {
    type: 'not_authorized';
}

export interface BadRequestResult {
    type: 'bad_request';
    errors: BadRequestError[];
}

export interface BadRequestError {
    path: (string | number)[];
    message: string;
}
