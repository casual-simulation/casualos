<template>
    <div class="date-of-birth-input" role="group" aria-labelledby="dob-label">
        <div id="dob-label" class="sr-only">Date of Birth</div>
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
                aria-label="Month"
                aria-describedby="dob-instructions"
                autocomplete="bday-month"
            />
            <span class="dob-separator" aria-hidden="true">/</span>
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
                aria-label="Day"
                aria-describedby="dob-instructions"
                autocomplete="bday-day"
            />
            <span class="dob-separator" aria-hidden="true">/</span>
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
                aria-label="Year"
                aria-describedby="dob-instructions"
                autocomplete="bday-year"
            />
        </div>
        <div id="dob-instructions" class="sr-only">
            Enter your date of birth. Use arrow keys to navigate between fields. Format: MM/DD/YYYY
        </div>
    </div>
</template>

<script src="./DateOfBirthInput.ts"></script>
<style src="./DateOfBirthInput.css" scoped></style>
