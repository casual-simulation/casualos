<template>
    <div class="login-container">
        <form @submit.prevent="submit">
            <md-card>
                <md-card-header>
                    <div class="md-title">What experience are you using?</div>
                </md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <md-field>
                                <label for="service">Name</label>
                                <md-input
                                    name="service"
                                    id="service"
                                    v-model="service"
                                    :disabled="processing"
                                />
                            </md-field>
                        </div>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button type="submit" class="md-primary" :disabled="processing"
                        >Save</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./AuthSelect.ts"></script>
<style src="./AuthSelect.css" scoped></style>
