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

import fs from 'fs';
import path from 'path';
import root from './root-path.cjs';

const outputFolder = path.resolve(root, './temp');
const output = path.join(outputFolder, 'config.json');

const distFolder = path.resolve(root, './src/aux-server/aux-web/dist/api');
const distOutput = path.join(distFolder, 'config');

const webConfig = {
    version: null,
    causalRepoConnectionProtocol:
        process.env.CAUSAL_REPO_CONNECTION_PROTOCOL || 'websocket',
    causalRepoConnectionUrl: process.env.CAUSAL_REPO_CONNECTION_URL,
    collaborativeRepoLocalPersistence:
        process.env.COLLABORATIVE_REPO_LOCAL_PERSISTENCE === 'true',
    staticRepoLocalPersistence:
        process.env.STATIC_REPO_LOCAL_PERSISTENCE !== 'false',
    sharedPartitionsVersion: process.env.SHARED_PARTITIONS_VERSION || 'v2',
    vmOrigin: process.env.VM_ORIGIN || null,
    authOrigin: process.env.AUTH_ORIGIN || null,
    recordsOrigin: process.env.RECORDS_ORIGIN || null,
    disableCollaboration: process.env.DISABLE_COLLABORATION === 'true',
    ab1BootstrapURL: process.env.AB1_BOOTSTRAP_URL || null,
    arcGisApiKey: process.env.ARC_GIS_API_KEY || null,
    jitsiAppName:
        process.env.JITSI_APP_NAME ||
        'vpaas-magic-cookie-332b53bd630448a18fcb3be9740f2caf',
    what3WordsApiKey: process.env.WHAT_3_WORDS_API_KEY || 'Z0NHMSXQ',
    playerMode: process.env.AUX_PLAYER_MODE,
    requirePrivoLogin: process.env.REQUIRE_PRIVO_LOGIN === 'true',
    allowedBiosOptions: process.env.BIOS_OPTIONS?.split(',') || null,
    defaultBiosOption: process.env.DEFAULT_BIOS_OPTION || null,
    automaticBiosOption: process.env.AUTOMATIC_BIOS_OPTION || null,
    enableDom: process.env.ENABLE_DOM === 'true',

    logoUrl: process.env.LOGO_URL || null,
    logoTitle: process.env.LOGO_TITLE || null,
    logoBackgroundColor: process.env.LOGO_BACKGROUND_COLOR || null,
};

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(outputFolder, { recursive: true }, (err) => {
    if (err) throw err;

    fs.writeFileSync(output, JSON.stringify(webConfig), {
        encoding: 'utf8',
    });
});

// Creates /tmp/a/apple, regardless of whether `/tmp` and /tmp/a exist.
fs.mkdir(distFolder, { recursive: true }, (err) => {
    if (err) throw err;

    fs.writeFileSync(distOutput, JSON.stringify(webConfig), {
        encoding: 'utf8',
    });
});
