<template>
  <tr class="file-row">
    <td class="file-close">
      <md-button class="md-icon-button md-dense" @click="toggleFile(file)">
        <md-icon>close</md-icon>
        <md-tooltip md-delay="1000" md-direction="top">Unselect Item</md-tooltip>
      </md-button>
    </td>
    <td class="file-id">{{file.id.substring(0, 5)}}</td>
    <td v-if="file.type === 'object'" v-for="tag in tags" :key="tag">
      <file-value :file="file" :tag="tag" @tagChanged="onTagChanged"></file-value>
    </td>
  </tr>
</template>
<script src="./FileRow.ts"></script>
<style src="./FileRow.css"></style>