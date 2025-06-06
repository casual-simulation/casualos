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
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { SvgIcon } from '@casual-simulation/aux-components';
import AuthRecordsData from '../AuthRecordsData/AuthRecordsData';
import AuthRecordsFiles from '../AuthRecordsFiles/AuthRecordsFiles';
import AuthRecordsEvents from '../AuthRecordsEvents/AuthRecordsEvents';
import AuthRecordsRoles from '../AuthRecordsRoles/AuthRecordsRoles';
import AuthRecordsInsts from '../AuthRecordsInsts/AuthRecordsInsts';
import AuthRecordsWebhooks from '../AuthRecordsWebhooks/AuthRecordsWebhooks';
import AuthRecordsNotifications from '../AuthRecordsNotifications/AuthRecordsNotifications';
import AuthRecordsPackages from '../AuthRecordsPackages/AuthRecordsPackages';

@Component({
    components: {
        'svg-icon': SvgIcon,
        'records-data': AuthRecordsData,
        'records-files': AuthRecordsFiles,
        'records-events': AuthRecordsEvents,
        'records-roles': AuthRecordsRoles,
        'records-insts': AuthRecordsInsts,
        'records-webhooks': AuthRecordsWebhooks,
        'records-notifications': AuthRecordsNotifications,
        'records-packages': AuthRecordsPackages,
    },
})
export default class AuthRecords extends Vue {
    @Prop({ required: true })
    recordName: string;

    created() {}
}
