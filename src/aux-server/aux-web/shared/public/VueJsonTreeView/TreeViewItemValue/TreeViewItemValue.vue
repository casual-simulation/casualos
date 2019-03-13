<template>
  <div>
    <span class="tree-view-item-key">{{keyString}}</span>
    <input
      v-if="modifiable"
      class="tree-view-item-value"
      :class="getValueType(data)"
      v-model="valueString"
      @keyup.enter="onUpdateData"
      @blur="onUpdateData"
    >
    <span v-else class="tree-view-item-value" :class="getValueType(data)" v-html="valueFormed"></span>
    <span v-show="error">{{ error }}</span>
  </div>
</template>
<script src="./TreeViewItemValue.ts"></script>