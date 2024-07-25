/**
 *  Throws an error if the response object does not contain success property set to true
 * @param definition A string that describes the response object
 * @param response The response object to check
 */
export const throwIfNotSuccess = (definition: string, response: unknown) => {
    if (
        typeof response !== 'object' ||
        response === null ||
        !(response as Record<string, unknown>)?.success
    ) {
        throw new Error(
            `${definition}.\nResponse Reference [expected object with success property true]?: ${response}`
        );
    }
};
