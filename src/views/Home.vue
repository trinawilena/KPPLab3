<template>
  <v-container>
    <v-container
      v-for="({ title, content, votes, voted }, key) in list"
      :key="key"
    >
      <v-card hover>
        <v-card-title>
          {{ title }}

          <v-spacer />
          <div v-if="user">
            <v-btn
              v-if="user.isAdmin"
              color="error"
              @click="deletePost(key)"
            >
              <v-icon> mdi-trash-can </v-icon>
            </v-btn>

            <v-btn @click="toggleVote(key)">
              {{ voted ? "Снять голос" : "Проголосовать" }}
            </v-btn>
          </div>
        </v-card-title>
        <v-card-subtitle class="text-left">
          Всего голосов: {{ votes }}
        </v-card-subtitle>

        <v-card-text style="white-space: pre-line" class="text-left">
          {{ content }}
        </v-card-text>
      </v-card>
    </v-container>
  </v-container>
</template>

<script>
import Vue from "vue";
export default {
  name: "Home",
  data() {
    return {
      list: [],
    };
  },
  computed: {
    user() {
      return this.$store.state.user;
    },
  },
  methods: {
    async toggleVote(id) {
      const response = (
        await this.$store.dispatch("toggleVote", this.list[id]._id)
      )?.data || [0, false];
      this.list[id].votes = response[0];
      this.list[id].voted = response[1];
    },
    async deletePost(id) {
      if (!(await this.$store.dispatch("deletePost", this.list[id]._id))) {
        return;
      }
      Vue.delete(this.list, id);
    },
  },
  async created() {
    this.list = (await this.$store.dispatch("getPostList"))?.data || [];
    console.log(this.list);
  },
};
</script>