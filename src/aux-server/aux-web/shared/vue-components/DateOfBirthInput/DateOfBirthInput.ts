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
import { Prop, Watch } from 'vue-property-decorator';

@Component
export default class DateOfBirthInput extends Vue {
    // @Prop({ type: String, default: 'Date of Birth' }) label!: string;
    @Prop({ type: Boolean, default: false }) disabled!: boolean;
    @Prop({ type: String, default: '' }) value!: string;
    // @Prop({ type: String, default: '' }) errorMessage!: string;

    month = '';
    day = '';
    year = '';
    error = '';

    $refs!: {
        monthInput: Vue & { $el: HTMLElement };
        dayInput: Vue & { $el: HTMLElement };
        yearInput: Vue & { $el: HTMLElement };
    };

    created() {
        // Initialize from value if provided (format: MM/DD/YYYY)
        if (this.value) {
            const parts = this.value.split('/');
            if (parts.length === 3) {
                this.month = parts[0];
                this.day = parts[1];
                this.year = parts[2];
            }
        }
    }

    @Watch('month')
    @Watch('day')
    @Watch('year')
    onInputChange() {
        this.emitDateChange();
    }

    emitDateChange() {
        if (!this.month && !this.day && !this.year) {
            this.$emit('input', '');
            return;
        }

        if (this.isValidDate()) {
            this.$emit('input', `${this.year}-${this.month}-${this.day}`);
        } else {
            this.$emit('input', '');
        }
    }

    isValidDate(): boolean {
        if (!this.month || !this.day || !this.year) {
            this.error = 'Please enter a valid date.';
            return false;
        }

        const monthNum = parseInt(this.month);
        const dayNum = parseInt(this.day);
        const yearNum = parseInt(this.year);

        if (isNaN(monthNum) || isNaN(dayNum) || isNaN(yearNum)) {
            this.error = 'Please enter a valid date.';
            return false;
        }

        if (monthNum < 1 || monthNum > 12) {
            this.error = 'Please enter a valid month (1-12).';
            return false;
        }

        // Check for valid days in month
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        if (dayNum > daysInMonth) {
            this.error = `Please enter a valid day (1-${daysInMonth}) for the selected month.`;
            return false;
        } else if (dayNum < 1 || dayNum > 31) {
            this.error = `Please enter a valid day (1-${daysInMonth}) for the selected month.`;
            return false;
        }

        if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
            this.error = `Please enter a valid year (1900 - ${new Date().getFullYear()}).`;
            return false;
        }

        return true;
    }

    // Input handlers
    handleMonthInput() {
        // Ensure only numbers are entered
        this.month = this.month.replace(/\D/g, '');

        // Auto move to day input when 2 digits are entered
        if (this.month.length === 2) {
            // Validate month (1-12)
            const monthNum = parseInt(this.month);
            if (monthNum > 0 && monthNum <= 12) {
                this.$refs.dayInput.$el.focus();
            }
        }
    }

    handleDayInput() {
        // Ensure only numbers are entered
        this.day = this.day.replace(/\D/g, '');

        // Auto move to year input when 2 digits are entered
        if (this.day.length === 2) {
            // Validate day (1-31)
            const dayNum = parseInt(this.day);
            if (dayNum > 0 && dayNum <= 31) {
                this.$refs.yearInput.$el.focus();
            }
        }
    }

    handleYearInput() {
        // Ensure only numbers are entered
        this.year = this.year.replace(/\D/g, '');
    }

    handleMonthKeydown(event: KeyboardEvent) {
        // Move to previous field when backspace is pressed on empty input
        if (event.key === 'Backspace' && this.month === '') {
            // No previous field for month
        }
        // Navigate with arrow keys only when cursor is at the edge
        else if (event.key === 'ArrowRight') {
            const input = event.target as HTMLInputElement;
            const cursorPosition = input.selectionStart;
            const inputLength = this.month.length;

            // Only move to next field if cursor is at the end
            if (cursorPosition === inputLength) {
                event.preventDefault();
                this.$refs.dayInput.$el.focus();
            }
        }
    }

    handleDayKeydown(event: KeyboardEvent) {
        // Move to previous field when backspace is pressed on empty input
        if (event.key === 'Backspace' && this.day === '') {
            this.$refs.monthInput.$el.focus();
        }
        // Navigate with arrow keys only when cursor is at the edge
        else if (event.key === 'ArrowLeft') {
            const input = event.target as HTMLInputElement;
            const cursorPosition = input.selectionStart;

            // Only move to previous field if cursor is at the beginning
            if (cursorPosition === 0) {
                event.preventDefault();
                this.$refs.monthInput.$el.focus();
            }
        } else if (event.key === 'ArrowRight') {
            const input = event.target as HTMLInputElement;
            const cursorPosition = input.selectionStart;
            const inputLength = this.day.length;

            // Only move to next field if cursor is at the end
            if (cursorPosition === inputLength) {
                event.preventDefault();
                this.$refs.yearInput.$el.focus();
            }
        }
    }

    handleYearKeydown(event: KeyboardEvent) {
        // Move to previous field when backspace is pressed on empty input
        if (event.key === 'Backspace' && this.year === '') {
            this.$refs.dayInput.$el.focus();
        }
        // Navigate with arrow keys only when cursor is at the edge
        else if (event.key === 'ArrowLeft') {
            const input = event.target as HTMLInputElement;
            const cursorPosition = input.selectionStart;

            // Only move to previous field if cursor is at the beginning
            if (cursorPosition === 0) {
                event.preventDefault();
                this.$refs.dayInput.$el.focus();
            }
        }
    }
}
