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
import VueRouter, { RouteConfig } from 'vue-router';
import {
    MdButton,
    MdContent,
    MdApp,
    MdCard,
    MdToolbar,
    MdField,
    MdProgress,
    MdDrawer,
    MdList,
    MdMenu,
    MdDialog,
    MdDialogConfirm,
    MdDialogAlert,
    MdDatepicker,
    MdTabs,
    MdCheckbox,
    MdTooltip,
    MdSnackbar,
    MdSwitch,
    MdBadge,
    MdDialogPrompt,
    MdTable,
    MdChips,
    MdEmptyState,
    MdRipple,
} from 'vue-material/dist/components';
import 'vue-material/dist/vue-material.min.css';
import 'vue-material/dist/theme/default.css';

import '@casual-simulation/aux-components/fonts/MaterialIcons/MaterialIcons.css';
import '@casual-simulation/aux-components/fonts/Roboto/Roboto.css';
import '@casual-simulation/aux-components/fonts/NotoSansKR/NotoSansKR.css';

import '@casual-simulation/aux-components/SVGPolyfill';
import AuthApp from './AuthApp/AuthApp';
import AuthHome from './AuthHome/AuthHome';
import AuthLogin from './AuthLogin/AuthLogin';
import AuthEnterCode from './AuthEnterCode/AuthEnterCode';
import AuthRecords from './AuthRecords/AuthRecords';
import AuthRecordsData from './AuthRecordsData/AuthRecordsData';
import AuthRecordsFiles from './AuthRecordsFiles/AuthRecordsFiles';
import { authManager } from '../shared/index';
import AuthLoading from './AuthLoading/AuthLoading';
import { EventBus } from '@casual-simulation/aux-components';
import {
    listenForChannel,
    setupChannel,
} from '@casual-simulation/aux-vm-browser/html/IFrameHelpers';
import { skip } from 'rxjs/operators';
import AuthTerms from './AuthTerms/AuthTerms';
import AuthPrivacyPolicy from './AuthPrivacyPolicy/AuthPrivacyPolicy';
import AuthAcceptableUsePolicy from './AuthAcceptableUsePolicy/AuthAcceptableUsePolicy';

import 'virtual:svg-icons-register';
import AuthRecordsEvents from './AuthRecordsEvents/AuthRecordsEvents';
import AuthRecordsRoles from './AuthRecordsRoles/AuthRecordsRoles';
import AuthStudio from './AuthStudio/AuthStudio';
import AuthRecordsInsts from './AuthRecordsInsts/AuthRecordsInsts';
import './global.css';
import { appManager } from 'aux-web/shared/AppManager';
import OAuthRedirect from './OAuthRedirect/OAuthRedirect';
import PrivoRegistrationCard from './PrivoRegistrationCard/PrivoRegistrationCard';
import AuthChildrenPrivacyPolicy from './AuthChildrenPrivacyPolicy/AuthChildrenPrivacyPolicy';
import AuthRegisterWebAuthn from './AuthRegisterWebAuthn/AuthRegisterWebAuthn';

Vue.use(VueRouter);
Vue.use(MdButton);
Vue.use(MdCheckbox);
Vue.use(MdContent);
Vue.use(MdApp);
Vue.use(MdCard);
Vue.use(MdToolbar);
Vue.use(MdField);
Vue.use(MdProgress);
Vue.use(MdDrawer);
Vue.use(MdList);
Vue.use(MdMenu);
Vue.use(MdDialog);
Vue.use(MdDialogConfirm);
Vue.use(MdDialogAlert);
Vue.use(MdTabs);
Vue.use(MdTooltip);
Vue.use(MdTable);
Vue.use(MdSnackbar);
Vue.use(MdSwitch);
Vue.use(MdBadge);
Vue.use(MdDialogPrompt);
Vue.use(MdDatepicker);
Vue.use(MdChips);
Vue.use(MdEmptyState);
Vue.use(MdRipple);

const routes: RouteConfig[] = [
    {
        path: '/login',
        name: 'login',
        component: AuthLogin,
        props: (route) => ({
            after: route.query['after'],
        }),
    },
    {
        path: '/enter-code',
        name: 'code',
        component: AuthEnterCode,
        props: (route) => ({
            after: route.query['after'],
            userId: route.query['userId'],
            requestId: route.query['requestId'],
            address: route.query['address'],
            addressTypeToCheck: route.query['addressTypeToCheck'],
        }),
    },
    {
        path: '/terms',
        name: 'terms',
        component: AuthTerms,
    },
    {
        path: '/privacy-policy',
        name: 'privacy-policy',
        component: AuthPrivacyPolicy,
    },
    {
        path: '/children-privacy-policy',
        name: 'children-privacy-policy',
        component: AuthChildrenPrivacyPolicy,
    },
    {
        path: '/acceptable-use-policy',
        name: 'acceptable-use-policy',
        component: AuthAcceptableUsePolicy,
    },
    {
        path: '/olx-terms-of-service',
        name: 'olx-terms-of-service',
        redirect(to) {
            return {
                name: 'terms',
                hash: '#olx-services',
            };
        },
    },
    {
        path: '/',
        name: 'index',
        redirect: { name: 'home' },
    },
    {
        path: '/account',
        name: 'home',
        component: AuthHome,
    },
    {
        path: '/records/:recordName',
        name: 'records',
        props: (route) => ({
            recordName: route.params.recordName,
        }),
        component: AuthRecords,
        children: [
            {
                path: 'insts',
                name: 'records-insts',
                component: AuthRecordsInsts,
            },
            {
                path: 'data',
                name: 'records-data',
                component: AuthRecordsData,
            },
            {
                path: 'files',
                name: 'records-files',
                component: AuthRecordsFiles,
            },
            {
                path: 'events',
                name: 'records-events',
                component: AuthRecordsEvents,
            },
            {
                path: 'roles',
                name: 'records-roles',
                component: AuthRecordsRoles,
            },
        ],
    },
    {
        path: '/studios/:studioId/:studioName',
        name: 'studio',
        props: (route) => ({
            studioId: route.params.studioId,
            studioName: route.params.studioName,
        }),
        component: AuthStudio,
    },
    {
        path: '/oauth/redirect',
        name: 'oauth-redirect',
        component: OAuthRedirect,
    },
    {
        path: '/sign-up',
        name: 'sign-up',
        component: PrivoRegistrationCard,
    },
    {
        path: '/webauthn',
        name: 'webauthn-register',
        component: AuthRegisterWebAuthn,
        props: (route) => ({
            after: route.query['after'],
        }),
    }
];

const router = new VueRouter({
    mode: 'history',
    routes,
});

router.beforeEach((to, from, next) => {
    const fromComId = from.query?.comId ?? from.query?.comID;
    const toComId = to.query?.comId ?? to.query?.comID;
    if (!toComId && fromComId) {
        next({
            ...to,
            query: {
                ...(to.query ?? {}),
                comId: fromComId,
            },
        });
    } else {
        next();
    }
});

const manager = authManager;
let messagePort: MessagePort;

if (window.opener) {
    console.log(
        '[auth-aux/site/index] Opened by another tab. Setting up channel.'
    );
    const channel = setupChannel(window.opener);

    messagePort = channel.port1;

    messagePort.addEventListener('message', (message) => {
        if (message.data.type === 'close') {
            window.close();
        }
    });

    window.addEventListener('close', () => {
        if (messagePort) {
            messagePort.postMessage({
                type: 'close',
            });
        }
    });

    authManager.loginState.pipe(skip(1)).subscribe((loggedIn) => {
        if (messagePort) {
            if (loggedIn) {
                console.log('[auth-aux/site/index] Sending login event.');
                messagePort.postMessage({
                    type: 'login',
                    userId: authManager.userId,
                });
            }
        }
    });
}

let loading: Vue;

router.beforeEach((to, from, next) => {
    EventBus.$emit('startLoading');
    next();
});

const publicPages = new Set([
    'login',
    'sign-up',
    'code',
    'terms',
    'privacy-policy',
    'children-privacy-policy',
    'acceptable-use-policy',
    'olx-terms-of-service',
    'oauth-redirect',
]);

router.beforeEach(async (to, from, next) => {
    try {
        const loggedIn = manager.isLoggedIn();

        if (messagePort && loggedIn) {
            if (!manager.userInfoLoaded) {
                await manager.loadUserInfo();
            }

            messagePort.postMessage({
                type: 'login',
                userId: authManager.userId,
            });

            next();
            return;
        }

        if (loggedIn && !manager.userInfoLoaded) {
            try {
                await manager.loadUserInfo();

                if (
                    to.name === 'login' ||
                    to.name === 'sign-up' ||
                    to.name === 'code'
                ) {
                    console.log(
                        '[index] Already logged in. Redirecting to home.'
                    );

                    next({ name: 'home' });
                } else {
                    next();
                }
                return;
            } catch (err) {
                console.error('[index] Could not load User info.', err);
                next();
            }
        }

        if (!publicPages.has(to.name) && !loggedIn) {
            console.log('[index] Not Logged In and. Redirecting to Login.');
            next({ name: 'login' });
            return;
        } else {
            next();
            return;
        }
    } catch (err) {
        next();
        return;
    }
});

router.afterEach((to, from) => {
    EventBus.$emit('stopLoading');
});

async function start() {
    loading = new Vue({
        render: (createEle) => createEle(AuthLoading),
    }).$mount('#loading');

    const app = new Vue({
        router,
        render: (createEle) => createEle(AuthApp),
    }).$mount('#app');
}

start();
