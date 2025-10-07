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

import path from 'node:path';
import { defineConfig } from 'prisma/config';
import {
    listEnvironmentFiles,
    loadEnvFiles,
} from './aux-backend/shared/EnvUtils';

const auxBackend = path.join(__dirname, 'aux-backend');
const schemas = path.join(auxBackend, 'schemas');
const sqlite = path.join(schemas, 'sqlite');

loadEnvFiles(listEnvironmentFiles(sqlite));

export default defineConfig({
    schema: path.join(sqlite, 'auth.sqlite.prisma'),
    migrations: {
        path: path.join(sqlite, 'migrations'),
    },
});
