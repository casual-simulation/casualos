<template>
    <div class="login-container">
        <form @submit.prevent="login">
            <md-card>
                <md-card-header>
                    <div class="md-title">Login</div>
                </md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <md-field>
                                <label for="email">Email</label>
                                <md-input
                                    name="email"
                                    id="email"
                                    autocomplete="email"
                                    v-model="email"
                                    :disabled="processing"
                                />
                            </md-field>
                        </div>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button type="submit" class="md-primary" :disabled="processing"
                        >Login</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./AuthLogin.ts"></script>
<style src="./AuthLogin.css" scoped></style>
