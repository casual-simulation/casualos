import { procedure } from '@casual-simulation/aux-common';
import { CrudRecordsController } from './CrudRecordsController';
import { z } from 'zod';
import {
    INSTANCES_ARRAY_VALIDATION,
    MARKER_VALIDATION,
    RECORD_NAME_VALIDATION,
} from '../Validations';

/**
 * Gets a procedure that can be used to get an item from the given controller.
 * @param controller The controller to use.
 */
export function getItemProcedure<
    TController extends CrudRecordsController<any, any, any, any>
>(controller: TController) {
    return procedure()
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                address: z.string().min(1),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, address }, context) => {
            const validation = await this._validateSessionKey(
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
    TController extends CrudRecordsController<any, any, any, any>,
    TItemSchema extends z.ZodObject<any, any>
>(controller: TController, itemSchema: TItemSchema) {
    return procedure()
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                item: itemSchema,
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, item, instances }, context) => {
            const validation = await this._validateSessionKey(
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
    TController extends CrudRecordsController<any, any, any, any>
>(controller: TController) {
    return procedure()
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                startingAddress: z.string().optional(),
                marker: MARKER_VALIDATION.optional(),
                sort: z.enum(['ascending', 'descending']).optional(),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(
            async (
                { recordName, startingAddress, marker, sort, instances },
                context
            ) => {
                const validation = await this._validateSessionKey(
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
                        startingAddress,
                        sort,
                    });
                }

                return await controller.listItems({
                    recordName,
                    userId: validation.userId,
                    instances,
                    startingAddress,
                });
            }
        );
}

/**
 * Gets a procedure that can be used to erase an item from the given controller.
 * @param controller The controller to use.
 */
export function eraseItemProcedure<
    TController extends CrudRecordsController<any, any, any, any>
>(controller: TController) {
    return procedure()
        .inputs(
            z.object({
                recordName: RECORD_NAME_VALIDATION,
                address: z.string().min(1),
                instances: INSTANCES_ARRAY_VALIDATION.optional(),
            })
        )
        .handler(async ({ recordName, address, instances }, context) => {
            const validation = await this._validateSessionKey(
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
