export type WorkerEvent = GetTreeRequest | GetTreeResponse;

export interface GetTreeRequest {
    type: 'get_tree_req';
    treeType: string;
    id: string;
}

export interface GetTreeResponse {
    type: 'get_tree_resp';
    id: string;
}