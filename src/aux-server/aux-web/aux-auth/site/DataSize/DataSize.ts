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

@Component({
    components: {},
})
export default class DataSize extends Vue {
    @Prop({ required: true })
    sizeInBytes: number;

    get sizeInKiloBytes() {
        return this.sizeInBytes / 1000;
    }

    get sizeInMegaBytes() {
        return this.sizeInBytes / 1000000;
    }

    get sizeInGigaBytes() {
        return this.sizeInBytes / 1000000000;
    }

    get humanSize() {
        if (this.sizeInGigaBytes > 0.5) {
            return `${this.sizeInGigaBytes.toFixed(2)} GB`;
        } else if (this.sizeInMegaBytes > 0.5) {
            return `${this.sizeInMegaBytes.toFixed(2)} MB`;
        } else if (this.sizeInKiloBytes > 5) {
            return `${this.sizeInKiloBytes.toFixed(2)} KB`;
        } else {
            return `${this.sizeInBytes} Bytes`;
        }
    }
}
