import {
    InputlessProcedureBuilder,
    procedure,
    ProcedureBuilder,
} from '@casual-simulation/aux-common';
import { CrudRecordsController } from './CrudRecordsController';
import { z } from 'zod';
import {
    INSTANCES_ARRAY_VALIDATION,
    MARKER_VALIDATION,
    RECORD_NAME_VALIDATION,
} from '../Validations';
import { AuthController, validateSessionKey } from '../AuthController';

/**
 * Gets a procedure that can be used to get an item from the given controller.
 * @param controller The controller to use.
 */
export function getItemProcedure<
    TController extends CrudRecordsController<any, any, any>
>(
    auth: AuthController,
    controller: TController | null,
    builder: InputlessProcedureBuilder
) {
    return builder
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                address: z.string().min(1),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, address }, context) => {
            if (!controller) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                };
            }

            const validation = await validateSessionKey(
                auth,
                context.sessionKey
            );
            if (
                validation.success === false &&
                validation.errorCode !== 'no_session_key'
            ) {
                return validation;
            }

            const result = await controller.getItem({
                recordName,
                address,
                userId: validation.userId,
                instances: [],
            });
            return result;
        });
}

/**
 * Gets a procedure that can be used to record an item to the given controller.
 * @param controller The controller to use.
 * @param schema The schema to use for the controller input.
 */
export function recordItemProcedure<
    TController extends CrudRecordsController<any, any, any>,
    TItemSchema extends z.ZodObject<any, any>
>(
    auth: AuthController,
    controller: TController | null,
    itemSchema: TItemSchema,
    builder: InputlessProcedureBuilder
) {
    return builder
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                item: itemSchema,
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, item, instances }, context) => {
            if (!controller) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This feature is not supported.',
                };
            }

            const validation = await validateSessionKey(
                auth,
                context.sessionKey
            );
            if (
                validation.success === false &&
                validation.errorCode !== 'no_session_key'
            ) {
                return validation;
            }
            return await controller.recordItem({
                recordKeyOrRecordName: recordName,
                item,
                userId: validation.userId,
                instances,
            });
        });
}

/**
 * Gets a procedure that can be used to list the items in the given controller by record name.
 * @param controller The controller to use.
 */
export function listItemsProcedure<
    TController extends CrudRecordsController<any, any, any>
>(
    auth: AuthController,
    controller: TController | null,
    builder: InputlessProcedureBuilder
) {
    return builder
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                address: z.string().optional(),
                marker: MARKER_VALIDATION.optional(),
                sort: z.enum(['ascending', 'descending']).optional(),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(
            async (
                { recordName, address, marker, sort, instances },
                context
            ) => {
                if (!controller) {
                    return {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'This feature is not supported.',
                    };
                }
                const validation = await validateSessionKey(
                    auth,
                    context.sessionKey
                );
                if (
                    validation.success === false &&
                    validation.errorCode !== 'no_session_key'
                ) {
                    return validation;
                }

                if (marker) {
                    return await controller.listItemsByMarker({
                        recordName,
                        marker,
                        userId: validation.userId,
                        instances,
                        startingAddress: address,
                        sort,
                    });
                }

                return await controller.listItems({
                    recordName,
                    userId: validation.userId,
                    instances,
                    startingAddress: address,
                });
            }
        );
}

/**
 * Gets a procedure that can be used to erase an item from the given controller.
 * @param controller The controller to use.
 */
export function eraseItemProcedure<
    TController extends CrudRecordsController<any, any, any>
>(auth: AuthController, controller: TController | null) {
    return procedure()
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                address: z.string().min(1),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, address, instances }, context) => {
            const validation = await validateSessionKey(
                auth,
                context.sessionKey
            );
            if (
                validation.success === false &&
                validation.errorCode !== 'no_session_key'
            ) {
                return validation;
            }

            return await controller.eraseItem({
                recordName,
                address,
                userId: validation.userId,
                instances,
            });
        });
}
