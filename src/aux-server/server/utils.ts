import {Request, Response, Handler} from 'express';
import { AxiosError } from 'axios';

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch(er => {
                const err : AxiosError = er;
                if(err.response && err.response.data) {
                    console.error('An Axios request failed.', err, err.response.data);
                }

                next(er);
            });
    };
}