import { Observable } from 'rxjs';

export interface ConnectionClient {
    connectionState: Observable<boolean>;
    event<T>(name: string): Observable<T>;
    send(name: string, data: any): void;
    disconnect(): void;
}
