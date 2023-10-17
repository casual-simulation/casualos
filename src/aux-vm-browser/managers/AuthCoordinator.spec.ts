import { Subject, Subscription } from 'rxjs';
import { AuthCoordinator } from './AuthCoordinator';
import { BotManager } from './BotManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import { SimulationManager } from '@casual-simulation/aux-vm/managers';
import {
    ConnectionInfo,
    botAdded,
    createBot,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { AuxConfigParameters } from '@casual-simulation/aux-vm/vm';

describe('AuthCoordinator', () => {
    let manager: AuthCoordinator<BotManager>;
    let connectionId = 'connectionId';
    let sim: BotManager;
    let sub: Subscription;
    let vms: Map<string, TestAuxVM>;

    let simManager: SimulationManager<BotManager>;

    async function addSimulation(id: string) {
        const sim = await simManager.addSimulation(id, {
            recordName: null,
            inst: id,
        });

        simManager.primary.helper.transaction(
            botAdded(createBot(connectionId, {}))
        );

        await waitAsync();

        return sim;
    }

    beforeEach(async () => {
        sub = new Subscription();
        vms = new Map();

        const connection: ConnectionInfo = {
            connectionId: connectionId,
            userId: 'userId',
            sessionId: 'sessionId',
        };

        const config: AuxConfigParameters = {
            version: 'v1.0.0',
            versionHash: 'hash',
        };

        simManager = new SimulationManager((id, options) => {
            const vm = new TestAuxVM(id, connection.connectionId);
            vm.processEvents = true;
            vm.localEvents = new Subject();
            vms.set(id, vm);
            return new BotManager(options, config, vm);
        });

        await simManager.setPrimary('sim-1', {
            recordName: null,
            inst: 'sim-1',
        });
        sim = await addSimulation('sim-1');

        manager = new AuthCoordinator(simManager);

        // sub.add(
        //     manager.onItemsUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => updates.push(u))
        // );
        // sub.add(
        //     manager.onSelectionUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => selectionUpdates.push(u))
        // );
        // sub.add(
        //     manager.onRecentsUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => recentsUpdates.push(u))
        // );
        // sub.add(
        //     manager.onSearchResultsUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => searchUpdates.push(u))
        // );
        // sub.add(
        //     manager.onDiffUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => diffUpdates.push(u))
        // );
        // sub.add(
        //     manager.onDiffSelectionUpdated
        //         .pipe(skip(1))
        //         .subscribe((u) => diffSelectionUpdates.push(u))
        // );
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('');
});
