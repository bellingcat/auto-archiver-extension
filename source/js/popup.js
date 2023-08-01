import { createApp } from 'vue';
import Popup from '../vue/Popup.vue';
import 'materialize-css/dist/css/materialize.min.css';
import '@material-design-icons/font';

const app = createApp(Popup);
app.mount('#app');

document.addEventListener('DOMContentLoaded', async () => {
	M.Tooltip.init(document.querySelectorAll('.tooltipped'), { enterDelay: 500 }); // enable tooltips
});

