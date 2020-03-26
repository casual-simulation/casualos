// CasualOS has several key components:
//
// 1. Simulations - These are wrapper objects that manage creating and interfacing with AUX virtual machines.
// 2. VM - AUX Virtual Machines provide a security boundary to keep user scripts separate across multiple virtual machines.
// 3. Channel - These are manager objects which handle the persistence and runtime aspects of an AUX.
// 4. Partitions - These are services which manage the persistence and realtime sync of the AUX data model.
// 5. Runtimes - These are services which manage script execution and formula precalculation.

import { BotAction, StateUpdatedEvent } from '../bots';
import { Observable } from 'rxjs';

/**
 * Defines an class that is able to manage the runtime state of an AUX.
 *
 * Being a runtime means providing and managing the execution state that an AUX is in.
 * This means taking state updates events, shouts and whispers, and emitting additional events to affect the future state.
 */
export class AuxRuntime {
    /**
     * An observable that resolves whenever the runtime issues an action.
     */
    onActions: Observable<BotAction[]>;

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * @param eventName The name of the event.
     * @param botIds The Bot IDs that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    shout(eventName: string, botIds: string[], arg?: any): void {}

    /**
     * Executes the given script.
     * @param script The script to run.
     */
    execute(script: string): void {}

    /**
     * Updates the internal state of the runtime.
     * @param update The update that should be integrated.
     */
    update(update: StateUpdatedEvent): void {}
}
