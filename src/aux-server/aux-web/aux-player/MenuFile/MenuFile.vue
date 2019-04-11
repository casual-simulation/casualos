<!-- App.vue -->
<template>
  <md-list-item class="menu-file" :class="{ 'active': selected }" :style="{ 'background-color': backgroundColor }" @click="click()">
      <div class="menu-file-text" v-show="label" :style="{ 'color': labelColor }">{{label}}</div>

      <md-dialog :md-active.sync="showDialog" @md-closed="closeDialog()">
          <md-dialog-title>{{label}}</md-dialog-title>
          <md-dialog-content>
            <md-field>
                <label>{{placeholder}}</label>
                <md-input v-model="inputValue" @keyup.enter="saveDialog()"></md-input>
            </md-field>
          </md-dialog-content>
          <md-dialog-actions>
              <md-button @click="closeDialog()">Cancel</md-button>
              <md-button @click="saveDialog()" class="md-primary">Save</md-button>
          </md-dialog-actions>
      </md-dialog>
  </md-list-item>
</template>
<script src="./MenuFile.ts"></script>
<style src="./MenuFile.css"></style>