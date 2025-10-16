import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import ThreeModelViewer from './components/ThreeModelViewer.vue'

const app = createApp(App)
app.use(router)

// 注册全局组件
app.component('ThreeModelViewer', ThreeModelViewer)

app.mount('#app')
