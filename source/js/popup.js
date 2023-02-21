import { createApp } from "vue";
import Popup from "../vue/Popup.vue";
import 'materialize-css/dist/css/materialize.min.css'
import 'material-design-icons/iconfont/material-icons.css'


const app = createApp(Popup);
app.mount("#app");

// Import browser from 'webextension-polyfill';
// import optionsStorage from './options-storage.js';

document.addEventListener('DOMContentLoaded', async () => {
	// TODO: uncomment if using options
	// listenForOptionsClick();
});

// Function listenForOptionsClick() {
// 	document.querySelector('#optionsBtn').addEventListener('click', () => {
// 		browser.runtime.openOptionsPage();
// 	});
// }