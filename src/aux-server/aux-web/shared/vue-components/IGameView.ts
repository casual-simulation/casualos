import { BotCursorType } from '@casual-simulation/aux-common';
import Vue from 'vue';
import { Game } from '../scene/Game';

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView extends Vue {
    _game: Game;

    readonly gameView: HTMLElement;
    readonly container: HTMLElement;
    readonly dev: boolean;

    calculateContainerSize(): { width: number; height: number };
    resize(): void;

    /**
     * Sets the cursor that should be used for the game view.
     */
    setCursor(cursor: BotCursorType): void;
}
