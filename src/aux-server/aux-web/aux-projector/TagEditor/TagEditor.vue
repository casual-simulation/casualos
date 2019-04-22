<template>
    <md-menu class="tag-editor" md-size="medium" md-align-trigger :md-active="showMenu">
        <span v-if="!useMaterialInput">
            <!-- If you're wondering why this syntax is not -->
            <!-- formatted very well, it's because spacing in HTML is significant -->
            <!-- and we need the space to be ignored -->
            <!-- See also: https://stackoverflow.com/a/2629446 -->
            <span v-if="!isAction" class="hashtag">#</span><span v-else class="event-name">+</span
            ><input
                ref="inputBox"
                :value="editorValue"
                @input="onInput($event.target.value)"
                @focus.stop="onFocus"
                @blur.stop="onBlur"
                autocapitalize="none"
                autocorrect="off"
            />
        </span>
        <span v-else>
            <md-field ref="mdField">
                <span v-if="!isAction" class="hashtag md-prefix">#</span>
                <span v-else class="event-name-svg-container md-prefix"
                    ><combine-icon class="event-name-svg"
                /></span>
                <input
                    class="md-input"
                    ref="inputBox"
                    v-bind:value="editorValue"
                    :placeholder="placeholder"
                    v-on:input="onInput"
                    @focus.stop="onFocus"
                    @blur.stop="onBlur"
                    autocapitalize="none"
                    autocorrect="off"
                />
                <!-- <md-input 
                ref="inputBox"
                :value="editorValue" 
                :placeholder="placeholder"
                @input="onInput($event)"
                @focus.stop="onFocus"
                @blur.stop="onBlur"
                autocapitalize="none"
                autocorrect="off"></md-input> -->
            </md-field>
        </span>

        <md-menu-content>
            <md-menu-item v-if="errorMessage" class="tag-editor-error">
                {{ errorMessage }}
            </md-menu-item>
            <!-- <md-menu-item>Test</md-menu-item> -->
        </md-menu-content>
    </md-menu>
</template>
<script src="./TagEditor.ts"></script>
<style src="./TagEditor.css"></style>
