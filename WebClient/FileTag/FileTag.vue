<template>
  <span class="tag">
    <span v-if="!isFilter">
      <span class="hashtag">#</span><span class="tag-name">{{tag}}</span>
    </span>
    <span v-else class="filter">
      <span v-if="!isCombine" class="event-name">{{filterData.eventName}}</span>
      <span v-else><img class="event-name-img" src="../public/images/combine_files.png"/></span>
      <span class="filter-condition">
        <span class="hashtag">#</span><span class="tag-name">{{filterData.filter.tag}}</span>:<span class="tag-value">{{filterData.filter.value}}</span>
      </span>
    </span>
  </span>
</template>
<script src="./FileTag.ts"></script>
<style src="./FileTag.css"></style>