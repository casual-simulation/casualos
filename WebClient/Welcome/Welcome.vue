<!-- App.vue -->
<template>
  <div>
    <form novalidate class="md-layout login-form" @submit.prevent="createUser">
      <md-card>
        <md-card-header>
          <div class="md-title">Create Account</div>
        </md-card-header>

        <md-card-content>
          <div>
            <md-field>
              <label for="name">Email</label>
              <md-input name="email" id="email" autocomplete="email" v-model="email"/>
            </md-field>
          </div>
          <div class="continue-as-guest-section">
            <span>Don't want an account?</span>
            <a class="md-primary guest-button" @click="continueAsGuest">Continue as a Guest</a>
          </div>
        </md-card-content>

        <md-card-actions>
          <md-button type="submit" class="md-primary md-raised">Next</md-button>
        </md-card-actions>
      </md-card>
    </form>

    <!-- <form novalidate class="md-layout" @submit.prevent="validateUser">
      <md-card class="md-layout-item md-size-50 md-small-size-100">
        <md-card-header>
          <div class="md-title">Users</div>
        </md-card-header>

        <md-card-content>
          <div class="md-layout md-gutter">
            <div class="md-layout-item md-small-size-100">
              <md-field>
                <label for="first-name">First Name</label>
                <md-input name="first-name" id="first-name" autocomplete="given-name" v-model="form.firstName" :disabled="sending" />
                <span class="md-error" v-if="!$v.form.firstName.required">The first name is required</span>
                <span class="md-error" v-else-if="!$v.form.firstName.minlength">Invalid first name</span>
              </md-field>
            </div>
        </md-card-content>

        <md-card-actions>
          <md-button type="submit" class="md-primary" :disabled="sending">Create user</md-button>
        </md-card-actions>
      </md-card>

      <md-snackbar :md-active.sync="userSaved">The user {{ lastUser }} was saved with success!</md-snackbar>
    </form> -->
  </div>
</template>
<script src="./Welcome.ts"></script>
<style src="./Welcome.css"></style>