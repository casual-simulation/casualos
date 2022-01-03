export function awsResult(value: any) {
    return {
        promise() {
            return Promise.resolve(value);
        },
    };
}

export function awsError(error: any) {
    return {
        promise() {
            return Promise.reject(error);
        },
    };
}

export class ConditionalCheckFailedException extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'ConditionalCheckFailedException';
    }
}
