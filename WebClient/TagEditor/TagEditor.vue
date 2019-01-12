<template>
  <md-menu md-size="medium" md-align-trigger :md-active="showMenu">
    <span>
        <span class="hashtag">#</span><input :value="value" 
            @input="onInput($event.target.value)"
            @focus.stop="onFocus"
            @blur.stop="onBlur">
    </span>

    <md-menu-content>
        <md-menu-item v-if="errorMessage" class="tag-editor-error">
            
            {{errorMessage}}
        </md-menu-item>
        <!-- <md-menu-item>Test</md-menu-item> -->
    </md-menu-content>
  </md-menu>
</template>
<script src="./TagEditor.ts"></script>
<style src="./TagEditor.css"></style>