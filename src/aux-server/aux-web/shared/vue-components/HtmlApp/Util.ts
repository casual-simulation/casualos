import type { RegisterHtmlAppAction } from '@casual-simulation/aux-common';
import { asyncResult, hasValue } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import type { HtmlPortalSetupResult } from '@casual-simulation/aux-vm/portals/HtmlAppBackend';

export const eventNames = [] as string[];

export function resolveRegisterAppAction(
    simulation: BrowserSimulation,
    event: RegisterHtmlAppAction
) {
    if (hasValue(event.taskId)) {
        simulation.helper.transaction(
            asyncResult(event.taskId, {
                builtinEvents: eventNames,
            } as HtmlPortalSetupResult)
        );
    }
}
