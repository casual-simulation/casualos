import { BuilderBotDragOperation } from '../DragOperation/BuilderBotDragOperation';
import { Intersection, Vector2 } from 'three';
import {
    UserMode,
    Bot,
    duplicateBot,
    BotCalculationContext,
    getBotIndex,
    getBotPosition,
    objectsAtContextGridPosition,
    isBotMovable,
    getBotConfigContexts,
    isMinimized,
    isContextMovable,
    getBotDragMode,
    tagsOnBot,
} from '@casual-simulation/aux-common';
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { dropWhile } from 'lodash';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { BuilderNewBotDragOperation } from '../DragOperation/BuilderNewBotDragOperation';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * Bot Click Operation handles clicking of bots for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class BuilderBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    private _hit: Intersection;

    protected _simulation3D: BuilderSimulation3D;

    constructor(
        simulation: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        bot: AuxBot3D | ContextGroup3D,
        hit: Intersection,
        vrController: VRController3D
    ) {
        super(simulation, interaction, bot.bot, bot, vrController);
        this._hit = hit;
    }

    protected _getWorkspace(): BuilderGroup3D | null {
        return this._file3D instanceof BuilderGroup3D ? this._file3D : null;
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        const mode = getBotDragMode(calc, this._file);

        if (
            mode === 'clone' ||
            this.game.getInput().getKeyHeld('Meta') ||
            this.game.getInput().getKeyHeld('Ctrl') ||
            this.game.getInput().getKeyHeld('Control')
        ) {
            return this._createCloneDragOperation(calc);
        } else if (mode === 'mod') {
            return this._createDiffDragOperation(calc);
        }

        const workspace = this._getWorkspace();
        if (!workspace) {
            const bot3D: AuxBot3D = <AuxBot3D>this._file3D;
            const context = bot3D.context;
            const fileWorkspace = this._interaction.findWorkspaceForMesh(
                this._file3D
            );
            const position = getBotPosition(calc, bot3D.bot, context);
            if (fileWorkspace && position) {
                const objects = objectsAtContextGridPosition(
                    calc,
                    context,
                    position
                );
                if (objects.length === 0) {
                    console.log('Found no objects at', position);
                    console.log(bot3D.bot);
                    console.log(context);
                }
                const bot = this._file;
                const draggedObjects = dropWhile(objects, o => o.id !== bot.id);
                return new BuilderBotDragOperation(
                    this._simulation3D,
                    this._interaction,
                    this._hit,
                    draggedObjects,
                    <BuilderGroup3D>workspace,
                    bot3D.context,
                    this._vrController
                );
            }
        }
        return new BuilderBotDragOperation(
            this._simulation3D,
            this._interaction,
            this._hit,
            [this._file3D.bot],
            <BuilderGroup3D>workspace,
            null,
            this._vrController
        );
    }

    protected _createCloneDragOperation(
        calc: BotCalculationContext
    ): BaseBotDragOperation {
        let duplicatedFile = duplicateBot(calc, <Bot>this._file);
        return new BuilderNewBotDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._file,
            this._vrController
        );
    }

    protected _createDiffDragOperation(
        calc: BotCalculationContext
    ): BaseBotDragOperation {
        const tags = tagsOnBot(this._file);
        let duplicatedFile = duplicateBot(calc, <Bot>this._file, {
            tags: {
                'aux.mod': true,
                'aux.mod.mergeTags': tags,
            },
        });
        return new BuilderNewBotDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._file,
            this._vrController
        );
    }

    protected _performClick(calc: BotCalculationContext): void {
        const workspace = this._getWorkspace();
        // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
        if (!workspace) {
            if (this._interaction.isInCorrectMode(this._file3D)) {
                // Select the bot we are operating on.
                this._interaction.selectFile(<AuxBot3D>this._file3D);
            }

            // If we're clicking on a workspace show the context menu for it.
        } else if (workspace) {
            if (
                !this._interaction.isInCorrectMode(this._file3D) &&
                this.simulation.recent.selectedRecentBot
            ) {
                // Create bot at clicked workspace position.
                let workspaceMesh = workspace.surface;
                let closest = workspaceMesh.closestTileToPoint(this._hit.point);

                if (closest) {
                    const context = this._interaction.firstContextInWorkspace(
                        workspace
                    );
                    let newFile = duplicateBot(
                        calc,
                        this.simulation.recent.selectedRecentBot,
                        {
                            tags: {
                                [context]: true,
                                [`${context}.x`]: closest.tile.gridPosition.x,
                                [`${context}.y`]: closest.tile.gridPosition.y,
                                [`${context}.z`]: closest.tile.localPosition.y,
                                [`${context}.sortOrder`]: 0,
                            },
                        }
                    );

                    this.simulation.helper.createBot(newFile.id, newFile.tags);
                }
            } else {
                this._interaction.showContextMenu(calc);
            }
        }
    }

    protected _canDragFile(calc: BotCalculationContext, bot: Bot): boolean {
        if (this._file3D instanceof ContextGroup3D) {
            let tags = getBotConfigContexts(calc, bot);
            return (
                isContextMovable(calc, bot) &&
                isMinimized(calc, bot) &&
                tags.length > 0
            );
        } else {
            return isBotMovable(calc, bot);
        }
        // if (this._interaction.isInCorrectMode(this._file3D)) {
        //     if (this._interaction.isInWorksurfacesMode()) {
        //         let tags = getBotConfigContexts(calc, bot);
        //         if (tags.length > 0) {
        //             // Workspaces are always movable.
        //             return true;
        //         }
        //     }
        //     return isBotMovable(calc, bot);
        // }
        // return false;
    }
}
