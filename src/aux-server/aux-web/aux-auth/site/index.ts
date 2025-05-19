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

import Vue from 'vue';
import type { RouteConfig } from 'vue-router';
import VueRouter from 'vue-router';
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
import { setupChannel } from '@casual-simulation/aux-vm-browser/html/IFrameHelpers';
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
import OAuthRedirect from './OAuthRedirect/OAuthRedirect';
import PrivoRegistrationCard from './PrivoRegistrationCard/PrivoRegistrationCard';
import AuthChildrenPrivacyPolicy from './AuthChildrenPrivacyPolicy/AuthChildrenPrivacyPolicy';
import AuthRegisterWebAuthn from './AuthRegisterWebAuthn/AuthRegisterWebAuthn';
import AuthCodeOfConduct from './AuthCodeOfConduct/AuthCodeOfConduct';
import AuthRecordsWebhooks from './AuthRecordsWebhooks/AuthRecordsWebhooks';
import AuthRecordsNotifications from './AuthRecordsNotifications/AuthRecordsNotifications';
import AuthRecordsPackages from './AuthRecordsPackages/AuthRecordsPackages';
import AuthGrantedEntitlements from './AuthGrantedEntitlements/AuthGrantedEntitlements';

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
        path: '/code-of-conduct',
        name: 'code-of-conduct',
        component: AuthCodeOfConduct,
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
        path: '/granted-entitlements',
        name: 'granted-entitlements',
        component: AuthGrantedEntitlements,
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
            {
                path: 'webhooks',
                name: 'records-webhooks',
                component: AuthRecordsWebhooks,
            },
            {
                path: 'notifications',
                name: 'records-notifications',
                component: AuthRecordsNotifications,
            },
            {
                path: 'packages',
                name: 'records-packages',
                component: AuthRecordsPackages,
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
    },
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

const sessionKeyUrl = authManager.getSessionKeyFromUrl();
const connectionKeyUrl = authManager.getConnectionKeyFromUrl();
if (sessionKeyUrl && connectionKeyUrl) {
    authManager.useTemporaryKeys(sessionKeyUrl, connectionKeyUrl);
}

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
    'code-of-conduct',
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
