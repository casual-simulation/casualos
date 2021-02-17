import { merge } from 'lodash';

/**
 * Adds the given function with the given name to the global aux namespace.
 * @param name The name of the function.
 * @param func The function.
 */
export function addDebugApi(name: string, func: (...args: any[]) => any) {
    mergeIntoAuxNamespace({
        [name]: func,
    });
}

function mergeIntoAuxNamespace(data: any) {
    if (typeof self !== 'undefined') {
        merge(self, {
            aux: data,
        });
    }
}
