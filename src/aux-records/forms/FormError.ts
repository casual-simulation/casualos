import { KnownErrorCodes } from '../Utils';
import { ZodIssue } from 'zod';

export const EMAIL_FIELD = 'email';
export const PARENT_EMAIL_FIELD = 'parentEmail';
export const NAME_FIELD = 'name';
export const DATE_OF_BIRTH_FIELD = 'dateOfBirth';
export const DISPLAY_NAME_FIELD = 'displayName';
export const TERMS_OF_SERVICE_FIELD = 'termsOfService';
export const ADDRESS_FIELD = 'address';
export const CODE_FIELD = 'code';
export const REPORT_REASON_FIELD = 'reportReason';
export const REPORT_REASON_TEXT_FIELD = 'reportReasonText';
export const COM_ID_FIELD = 'comId';

/**
 * Defines a basic interface for a form error.
 */
export interface FormError {
    /**
     * The field that the error is for.
     * If null, then the error is a general error and should be displayed at the bottom of the form.
     */
    for: string;

    /**
     * The error code.
     */
    errorCode: string;

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface GenericResponse {
    success: boolean;
    errorCode?: KnownErrorCodes;
    errorMessage?: string;
    issues?: ZodIssue[];
}

const fieldMap: Map<KnownErrorCodes, string | null> = new Map([
    ['email_already_exists', EMAIL_FIELD],
    ['parent_email_already_exists', PARENT_EMAIL_FIELD],
    ['parent_email_required', PARENT_EMAIL_FIELD],
    ['unacceptable_address', ADDRESS_FIELD],
    ['address_type_not_supported', ADDRESS_FIELD],
    ['unacceptable_address_type', ADDRESS_FIELD],
    ['invalid_code', CODE_FIELD],
    ['invalid_username', DISPLAY_NAME_FIELD],
    ['unacceptable_code', CODE_FIELD],
    ['invalid_display_name', DISPLAY_NAME_FIELD],
    ['user_is_banned', null],
    ['comId_already_taken', COM_ID_FIELD],
]);

/**
 * Gets the list of form errors that are applicable for the given response.
 * @param response
 */
export function getFormErrors(response: GenericResponse): FormError[] {
    if (response.success) {
        return [];
    }

    const errors: FormError[] = [];

    if (response.issues) {
        for (let issue of response.issues) {
            errors.push({
                for: issue.path.join('.'),
                errorCode: issue.code,
                errorMessage: issue.message,
            });
        }
    } else {
        const field = fieldMap.get(response.errorCode) ?? null;
        errors.push({
            for: field,
            errorCode: response.errorCode,
            errorMessage: response.errorMessage,
        });
    }

    return errors;
}
