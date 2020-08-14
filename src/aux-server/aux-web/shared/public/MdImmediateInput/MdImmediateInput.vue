<!-- 
Basically the same thing as MdInput but using the input event instead of v-model
to get values out of IME input events immediately.
-->
<template>
  <input
    class="md-input"
    v-bind="attributes"
    v-on:input="onInput"
    v-on="listeners"
    v-bind:value="model"
    @focus="onFocus"
    @blur="onBlur">
</template>

<script>
  import MdFieldMixin from 'vue-material/src/components/MdField/MdFieldMixin'
  import deepmerge from 'lodash/merge';

  const MdUuid = () => {
    return Math.random().toString(36).slice(4)
  }

  function MdComponent (newComponent) {
        const defaults = {
            props: {
                mdTheme: null
            },
            computed: {
                $mdActiveTheme () {
                    const { enabled, getThemeName, getAncestorTheme } = MdTheme

                    if (enabled && this.mdTheme !== false) {
                        return getThemeName(this.mdTheme || getAncestorTheme(this))
                    }

                    return null
                }
            }
        }

        return deepmerge(defaults, newComponent)
    }

  export default new MdComponent({
    name: 'MdImmediateInput',
    mixins: [MdFieldMixin],
    inject: ['MdField'],
    props: {
      id: {
        type: String,
        default: () => 'md-input-' + MdUuid()
      },
      type: {
        type: String,
        default: 'text'
      }
    },
    computed: {
      toggleType () {
        return this.MdField.togglePassword
      },
      isPassword () {
        return this.type === 'password'
      },
      listeners () {
        var l = {...this.$listeners}
        delete l.input
        return l
      }
    },
    watch: {
      type (type) {
        this.setPassword(this.isPassword)
      },
      toggleType (toggle) {
        if (toggle) {
          this.setTypeText()
        } else {
          this.setTypePassword()
        }
      }
    },
    methods: {
      onInput(event) {
          this.model = event.target.value;
      },
      setPassword (state) {
        this.MdField.password = state
        this.MdField.togglePassword = false
      },
      setTypePassword () {
        this.$el.type = 'password'
      },
      setTypeText () {
        this.$el.type = 'text'
      }
    },
    created () {
      this.setPassword(this.isPassword)
    },
    beforeDestroy () {
      this.setPassword(false)
    }
  })
</script>