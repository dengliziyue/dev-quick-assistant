import { createApp } from 'vue'
import App from './App.vue'
import '../styles/theme.css'
import { initSettings } from '../utils/settings'

initSettings()
  .catch(() => {})
  .finally(() => {
    createApp(App).mount('#app')
  })
