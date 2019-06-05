export type WorkerMessage =
    | WorkerProxyRequest
    | WorkerProxyResponse
    | WorkerProxySubscribe
    | WorkerProxyUnsubscribe
    | WorkerProxyEvent;

export interface WorkerProxyRequest {
    type: 'request';
    name: string;
    requestNumber: number;
    arguments: any[];
}

export interface WorkerProxyResponse {
    type: 'response';
    name: string;
    requestNumber: number;
    value?: any;
    error?: any;
}

export interface WorkerProxySubscribe {
    type: 'subscribe';
    name: string;
    arguments: any[];
    key: string;
}

export interface WorkerProxyUnsubscribe {
    type: 'unsubscribe';
    name: string;
    key: string;
}

export interface WorkerProxyEvent {
    type: 'event';
    key: string;
    value: any;
}

export interface ObservableRef {
    $isObservable: true;
    path: string;
    arguments: any[];
}
