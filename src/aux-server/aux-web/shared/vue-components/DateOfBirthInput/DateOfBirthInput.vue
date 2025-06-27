<template>
    <div class="date-of-birth-input">
        <div class="dob-inputs">
            <md-input
                type="text"
                inputmode="decimal"
                maxlength="2"
                placeholder="MM"
                class="dob-month"
                v-model="month"
                @input="handleMonthInput"
                @keydown="handleMonthKeydown"
                ref="monthInput"
                :disabled="disabled"
            />
            <span class="dob-separator">/</span>
            <md-input
                type="text"
                inputmode="decimal"
                maxlength="2"
                placeholder="DD"
                class="dob-day"
                v-model="day"
                @input="handleDayInput"
                @keydown="handleDayKeydown"
                ref="dayInput"
                :disabled="disabled"
            />
            <span class="dob-separator">/</span>
            <md-input
                type="text"
                inputmode="decimal"
                maxlength="4"
                placeholder="YYYY"
                class="dob-year"
                v-model="year"
                @input="handleYearInput"
                @keydown="handleYearKeydown"
                ref="yearInput"
                :disabled="disabled"
            />
        </div>
    </div>
</template>

<script src="./DateOfBirthInput.ts"></script>
<style src="./DateOfBirthInput.css" scoped></style>
