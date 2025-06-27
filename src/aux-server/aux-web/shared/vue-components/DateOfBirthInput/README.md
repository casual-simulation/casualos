# DateOfBirthInput Component

A Vue component for entering a date of birth with separate fields for month, day, and year.

## Features

-   Three separate input fields for month, day, and year
-   Automatic focus movement between fields when completed
-   Backspace navigation to previous fields
-   Input validation for valid dates
-   Customizable label
-   Error message display
-   Disabled state support

## Usage

```vue
<template>
    <div>
        <date-of-birth-input
            v-model="dateOfBirth"
            label="Date of Birth"
            :error-message="dobError"
            :disabled="processing"
            @input="validateDateOfBirth"
        />
    </div>
</template>

<script>
import DateOfBirthInput from '@/shared/vue-components/DateOfBirthInput/DateOfBirthInput.vue';

export default {
    components: {
        DateOfBirthInput,
    },
    data() {
        return {
            dateOfBirth: '',
            dobError: '',
            processing: false,
        };
    },
    methods: {
        validateDateOfBirth(value) {
            if (!value && this.requiresDob) {
                this.dobError = 'Date of birth is required';
            } else {
                this.dobError = '';
            }
        },
    },
};
</script>
```

## Props

| Name           | Type    | Default         | Description                          |
| -------------- | ------- | --------------- | ------------------------------------ |
| `label`        | String  | 'Date of Birth' | Label text for the input             |
| `disabled`     | Boolean | false           | Whether the input is disabled        |
| `value`        | String  | ''              | The date string in MM/DD/YYYY format |
| `errorMessage` | String  | ''              | Error message to display             |

## Events

| Name    | Parameters     | Description                                                                                         |
| ------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `input` | value (String) | Emitted when the date changes. Value is a string in MM/DD/YYYY format or an empty string if invalid |
