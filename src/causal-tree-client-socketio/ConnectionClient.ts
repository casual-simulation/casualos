import { Observable } from 'rxjs';

export interface ConnectionClient {
    event<T>(name: string): Observable<T>;
    send(name: string, data: any): void;
    disconnect(): void;
}
