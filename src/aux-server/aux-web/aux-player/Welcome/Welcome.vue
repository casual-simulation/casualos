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
              <label for="name">Name</label>
              <md-input name="name" id="name" autocomplete="name" v-model="email"/>
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
  </div>
</template>
<script src="./Welcome.ts"></script>
<style src="./Welcome.css"></style>