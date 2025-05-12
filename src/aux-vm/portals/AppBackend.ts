/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { RuntimeActions } from '@casual-simulation/aux-runtime';
import type { Observable } from 'rxjs';

/**
 * Defines an interface that manages the interaction between a app's runtime and how it is displayed on screen.
 */
export interface AppBackend {
    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the bot that manages this app.
     */
    botId: string;

    /**
     * The observable that resolves once the backend is setup.
     */
    onSetup: Observable<void>;

    /**
     * Handles the given events.
     */
    handleEvents(events: RuntimeActions[]): void;

    /**
     * Releases any dynamic resources used by this app.
     */
    dispose(): void;
}
