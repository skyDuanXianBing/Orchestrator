import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "./views/Dashboard.vue";
import TaskDetail from "./views/TaskDetail.vue";
import CreateTask from "./views/CreateTask.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Dashboard",
      component: Dashboard,
    },
    {
      path: "/task/:id",
      name: "TaskDetail",
      component: TaskDetail,
      props: true,
    },
    {
      path: "/create",
      name: "CreateTask",
      component: CreateTask,
    },
  ],
});
