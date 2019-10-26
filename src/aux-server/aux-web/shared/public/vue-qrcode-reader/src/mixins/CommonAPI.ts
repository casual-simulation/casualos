export default {
    methods: {
      async onDetect(resultPromise: any) {
        this.$emit("detect", resultPromise);
  
        try {
          const { content } = await resultPromise;
  
          if (content !== null) {
            this.$emit("decode", content);
          }
        } catch (error) {
          // fail silently
        }
      }
    }
  };