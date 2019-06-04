import Vue from 'vue';
import { Game } from '../scene/Game';

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView extends Vue {
    game: Game;

    readonly gameView: HTMLElement;
    readonly container: HTMLElement;
    readonly dev: boolean;
    readonly filesMode: boolean;
    readonly workspacesMode: boolean;

    calculateContainerSize(): { width: number; height: number };
    resize(): void;
}
