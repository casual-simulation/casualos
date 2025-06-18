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
import {} from '@casual-simulation/aux-common';
import TagColor from '../TagColor/TagColor';
import HighlightedText from '../HighlightedText/HighlightedText';

@Component({
    components: {
        'tag-color': TagColor,
        'highlighted-text': HighlightedText,
    },
})
export default class BotTag extends Vue {
    @Prop() tag: string;
    @Prop({ default: null }) prefix: string;

    /**
     * Whether the tag is allowed to be dragged from the bot table into the world.
     */
    @Prop({ default: true })
    allowCloning: boolean;

    /**
     * Whether the tag name should be rendered with a light font weight.
     */
    @Prop({ default: false })
    light: boolean;

    /**
     * The part of the tag that should be highlighted.
     */
    @Prop({ required: false, default: null })
    highlight: {
        startIndex: number;
        endIndex: number;
    };

    get isCombine() {
        return false;
    }

    get isScript() {
        return this.prefix === '@';
    }

    emitClick() {
        this.$emit('click');
    }

    constructor() {
        super();
    }
}
