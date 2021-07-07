import { AuxRuntime, BotAction } from '@casual-simulation/aux-common';
import { AuxHelper } from '../vm';
import { HtmlPortalBackend } from './HtmlPortalBackend';
import { PortalBackend } from './PortalBackend';

/**
 * Defines a class that manages the backend of custom portals.
 */
export class CustomPortalHelper {
    helper: AuxHelper;

    // TODO: implement portal backend that is passed all the updated bots and can determine when to call @onRender.
    portals: Map<string, PortalBackend> = new Map();

    constructor(helper: AuxHelper) {
        this.helper = helper;
    }

    handleEvents(events: BotAction[]): void {
        // TODO: process register_custom_portal events and create the corresponding backend objects.

        for (let event of events) {
            if (event.type === 'register_custom_portal') {
                let portalId = event.portalId;

                let backend: PortalBackend;
                if (event.options.type === 'html') {
                    backend = new HtmlPortalBackend(
                        portalId,
                        event.botId,
                        this.helper
                    );
                }
                this.portals.set(portalId, backend);
            }
        }
    }
}
