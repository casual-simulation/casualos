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
import Component from 'vue-class-component';
import Vue from 'vue';
import { hasValue } from '@casual-simulation/aux-common';
import { Prop } from 'vue-property-decorator';
import Tagline from '../Tagline/Tagline';

@Component({
    components: {
        tagline: Tagline,
    },
})
export default class Loading extends Vue {
    @Prop({ default: '' }) status: string;
    @Prop({ default: 0 }) progress: number;
    @Prop({ default: null }) error: string;
    @Prop({ default: false }) show: boolean;
    @Prop({}) version: string;
    @Prop({ default: 'Dismiss' }) errorAction: string;
    @Prop({ default: 'An error has occured.' }) errorTitle: string;

    @Prop({ default: null }) logoUrl: string;
    @Prop({ default: null }) logoTitle: string;
    @Prop({ default: null }) title: string;

    showSpinner: boolean;

    get hasError(): boolean {
        return hasValue(this.error);
    }

    onErrorDismiss() {
        this.$emit('dismiss');
    }

    created() {
        const circleElement = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
        );
        this.showSpinner = circleElement instanceof SVGElement;
    }
}
