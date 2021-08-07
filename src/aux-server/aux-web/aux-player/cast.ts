/**
 * MIT License
 *
 * Copyright (c) 2019 Casual Simulation, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * @license MIT
 */

import Vue from 'vue';

import PlayerApp from './PlayerApp/PlayerApp';
import Loading from '../shared/vue-components/Loading/Loading';
import { router } from './core';
import { appManager } from '../shared/AppManager';

appManager.isCastReceiver = true;

const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

const LOG_RECEIVER_TAG = 'Receiver';
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();

playerManager.addEventListener(
    cast.framework.events.EventType.ERROR,
    (event) => {
        castDebugLogger.error(
            LOG_RECEIVER_TAG,
            'Detailed Error Code - ' + event.detailedErrorCode
        );
        if (event && event.detailedErrorCode == 905) {
            castDebugLogger.error(
                LOG_RECEIVER_TAG,
                'LOAD_FAILED: Verify the load request is set up ' +
                    'properly and the media is able to play.'
            );
        }
    }
);

playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    (loadRequestData) => {
        castDebugLogger.debug(
            LOG_RECEIVER_TAG,
            `loadRequestData: ${JSON.stringify(loadRequestData)}`
        );
        const source = loadRequestData.media.contentId;
        appManager.setPrimarySimulation(source);

        return loadRequestData;
    }
);

async function start() {
    const loading = new Vue({
        render: (createEle) => createEle(Loading),
    }).$mount('#loading');

    // await appManager.initPromise;

    const app = new Vue({
        router,
        render: (createEle) => createEle(PlayerApp),
    }).$mount('#app');
}

start();
