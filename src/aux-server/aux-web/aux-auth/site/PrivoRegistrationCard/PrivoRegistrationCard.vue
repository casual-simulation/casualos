<template>
    <div class="register-container">
        <update-password-card
            v-if="updatePasswordUrl"
            :updatePasswordUrl="updatePasswordUrl"
            :requireParentEmail="requireParentEmail"
            @close="goHome()"
        ></update-password-card>
        <md-card v-else>
            <form v-if="enterDateOfBirth" @submit.prevent="provideDateOfBirth()">
                <md-card-header><div class="md-title">Register</div></md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <md-field class="md-has-value" :class="dateOfBirthFieldClass">
                                <label>Date of Birth</label>
                                <date-of-birth-input
                                    name="dateOfBirth"
                                    id="dateOfBirth"
                                    v-model="dateOfBirth"
                                    ref="dateOfBirth"
                                ></date-of-birth-input>
                                <field-errors field="dateOfBirth" :errors="errors" />
                            </md-field>
                        </div>
                    </div>
                    <field-errors :field="null" :errors="errors" />
                    <div class="policies-grid">
                        <div>
                            <p>
                                <a target="_blank" href="/privacy-policy">Privacy Policy</a>
                            </p>
                            <p>
                                <a target="_blank" href="/code-of-conduct">Code of Conduct</a>
                            </p>
                            <p>
                                <a target="_blank" href="/terms">Terms of Service</a>
                            </p>
                            <p v-if="supportUrl">
                                <a target="_blank" :href="supportUrl">Support</a>
                            </p>
                        </div>
                        <div class="spacer"></div>
                        <div class="policy-cert">
                            <a
                                style="display: inline-block; width: 70px; height: 70px"
                                target="_blank"
                                href="https://cert.privo.com/#/companies/casualsimulation"
                            >
                                <img
                                    src="https://privohub.privo.com/files/images/PRIVO_Cert/KPAS_C2V_104_4_72.png"
                                    alt="COPPA Safe Harbor Certification - Kids Privacy Assured by PRIVO"
                                />
                            </a>
                        </div>
                    </div>
                </md-card-content>
                <md-card-actions>
                    <md-button type="button" @click="provideDateOfBirth()" :disabled="processing">
                        <span>Continue</span>
                    </md-button>
                </md-card-actions>
            </form>
            <form v-else @submit.prevent="register">
                <md-card-header><div class="md-title">Register</div></md-card-header>
                <md-card-content class="input-dialog-content">
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <md-field :class="displayNameFieldClass">
                                <label for="name">Display Name</label>
                                <md-input
                                    name="displayName"
                                    id="displayName"
                                    v-model="displayName"
                                    :disabled="processing"
                                    @blur="checkDisplayName()"
                                />
                                <field-errors field="displayName" :errors="errors" />
                            </md-field>

                            <md-field :class="nameFieldClass">
                                <label for="firstName">First Name</label>
                                <md-input
                                    name="firstName"
                                    id="firstName"
                                    autocomplete="given-name"
                                    v-model="name"
                                    :disabled="processing"
                                    @blur="checkDisplayName()"
                                />
                                <field-errors field="name" :errors="errors" />
                            </md-field>

                            <md-field :class="dateOfBirthFieldClass">
                                <label for="dateOfBirth">Date of Birth</label>
                                <md-input
                                    name="dateOfBirth"
                                    id="dateOfBirth"
                                    :value="dateOfBirthText"
                                    disabled
                                />
                                <field-errors field="dateOfBirth" :errors="errors" />
                            </md-field>

                            <md-field v-if="showEmail" :class="emailFieldClass">
                                <label for="email">{{ registerEmailFieldHint }}</label>
                                <md-input
                                    name="email"
                                    id="email"
                                    autocomplete="email"
                                    v-model="email"
                                    :disabled="processing"
                                    @blur="checkEmail()"
                                />
                                <span v-if="!requireParentEmail" class="md-helper-text"
                                    >We require a valid email to set up your account.</span
                                >
                                <field-errors field="email" :errors="errors" />
                            </md-field>

                            <md-field v-if="requireParentEmail" :class="parentEmailFieldClass">
                                <label for="parentEmail">Enter Parent Email</label>
                                <md-input
                                    name="parentEmail"
                                    id="parentEmail"
                                    autocomplete="email"
                                    v-model="parentEmail"
                                    :disabled="processing"
                                />
                                <span class="md-helper-text"
                                    >We require a valid parent email to set up your account.</span
                                >
                                <field-errors field="parentEmail" :errors="errors" />
                            </md-field>
                        </div>
                    </div>
                    <div class="terms-of-service-container" v-if="requireTermsOfService">
                        <field-errors field="termsOfService" :errors="errors" />
                        <div class="terms-of-service-wrapper">
                            <md-checkbox v-model="acceptedTerms" id="terms-of-service">
                            </md-checkbox>
                            <label for="terms-of-service">
                                I accept the
                                <a target="_blank" href="/terms">Terms of Service</a>
                            </label>
                        </div>
                    </div>
                    <field-errors :field="null" :errors="errors" />
                    <div class="policies-grid">
                        <div>
                            <p>
                                <a target="_blank" href="/privacy-policy">Privacy Policy</a>
                            </p>
                            <p>
                                <a target="_blank" href="/code-of-conduct">Code of Conduct</a>
                            </p>
                            <p>
                                <a target="_blank" href="/terms">Terms of Service</a>
                            </p>
                        </div>
                        <div class="spacer"></div>
                        <div class="policy-cert">
                            <a
                                style="display: inline-block; width: 70px; height: 70px"
                                target="_blank"
                                href="https://cert.privo.com/#/companies/casualsimulation"
                            >
                                <img
                                    src="https://privohub.privo.com/files/images/PRIVO_Cert/KPAS_C2V_104_4_72.png"
                                    alt="COPPA Safe Harbor Certification - Kids Privacy Assured by PRIVO"
                                />
                            </a>
                        </div>
                    </div>
                </md-card-content>
                <md-card-actions>
                    <md-button type="button" @click="register()" :disabled="processing">
                        <md-progress-spinner
                            v-if="processing"
                            md-mode="indeterminate"
                            :md-diameter="20"
                            :md-stroke="2"
                            >Processing</md-progress-spinner
                        >
                        <span v-else>Register</span>
                    </md-button>
                </md-card-actions>
            </form>
        </md-card>
    </div>
</template>
<script src="./PrivoRegistrationCard.ts"></script>
<style src="./PrivoRegistrationCard.css" scoped></style>
