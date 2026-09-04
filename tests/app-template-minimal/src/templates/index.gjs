import { pageTitle  } from 'ember-page-title';
<template>
  {{pageTitle "index!"}}
  {{@model.message}}
</template>
