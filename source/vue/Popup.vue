<template>
	<p v-if="!login">
		please <a v-on:click="oauthLogin($event, true)" href="#" class="green-text">login</a> into your google account.
		<br />
		<br />
		If you <strong>don't see a popup</strong> make sure to
		<i>Allow Chrome Sign-in</i> <a v-on:click="openTab($event, 'chrome://settings/syncSetup')"
			href="javascript:void(0);">Chrome</a> or
		<i>Allow Google login for extensions</i> in <a v-on:click="openTab($event, 'brave://settings/extensions')"
			href="javascript:void(0);">Brave</a>.
	</p>
	<div v-if="errorMessage.length" class="red darken-1 white-text">Error: {{ errorMessage }}</div>
	<h5>
		<img src="../img/ben-archiver.png" alt="icon" id="icon">
		auto-archiver extension
		<!-- <button v-on:click="archive" class="tooltipped waves-effect waves-light btn-small right" data-position="bottom"
			data-tooltip="Archive this URL">
			<i class="material-icons left">cloud</i> Archive!
		</button> -->
		<button class="tooltipped waves-effect waves-light btn-small right modal-trigger" href="#archiveModal"
			data-position="bottom" data-tooltip="Archive this URL">
			<i class="material-icons left">cloud</i> Archive!
		</button>

		<button v-on:click="checkArchive"
			class="tooltipped waves-effect waves-light btn-small right flat light-blue darken-3" style="margin-right:10px;"
			data-position="bottom" data-tooltip="Check if this URL has been archived">lookup URL
		</button>

		<!-- Modal Trigger -->
		<!-- <a class="waves-effect waves-light btn modal-trigger" href="#archiveModal">Modal</a> -->

		<!-- Modal Structure -->
		<div id="archiveModal" class="modal bottom-sheet">
			<div class="modal-content">
				<span class="switch">
					<span class="form-guide">Visibility:</span>
					<label>
						private
						<input type="checkbox" checked v-model="public">
						<span class="lever"></span>
						public
					</label>
				</span>
				<span class="input-field col s12">
					<select class="browser-default" :disabled="public">
						<option value="-1" disabled selected>Group visibility level</option>
						<option value="">Only me</option>
						<option value="group1">Group 1</option>
						<option value="group2">Group 2</option>
					</select>
				</span>
				<div>
					<span class="form-guide">Tags:</span>
					<span class="chips" id="tagChips"></span>
					<a v-on:click="archive" href="#!"
						class="modal-close waves-effect waves-green right btn-small ">Archive</a>
				</div>
				{{ tags }}
			</div>
		</div>
	</h5>
	<!-- <label><input type="checkbox" v-model="takeScreenshot" /><span>take screenshot</span></label> -->
	<div class="input-field col s6">
		<i class="material-icons prefix">search</i>
		<input id="icon_prefix" type="text" ref="search" v-model="search" v-on:input="searchTasks">
		<label for="icon_prefix">Search for URLs</label>
	</div>
	<table class="archive-results" v-if="localTasksShownLength > 0 || onlineTasksLength > 0">
		<thead>
			<tr class="row">
				<th class="col s1"></th>
				<th class="col s5">URL</th>
				<th class="col s2">Result</th>
				<th class="col s3">Date</th>
			</tr>
		</thead>
		<tbody>
			<TaskItem v-for="t in displayTasks" :key="t.id" :initial-task="t" taskType="local" @remove="deleteTask" />
			<TaskItem v-for="t in onlineTasks" :key="t.id" :initial-task="t" taskType="online" />
		</tbody>
	</table>
	<div v-if="noSearchResults">
		No results... do you want to <a v-on:click="archive($event, search)" href="#">archive</a>?
	</div>
	<div style="height:100%"></div>
	<p>
		<span v-if="login">
			<a href="#" v-on:click="syncLocalTasks" class="tooltipped"
				data-tooltip="updates local database with entries submitted by the current user"
				data-position="top">Sync</a>
			my cloud archives
			&nbsp;|&nbsp;
			<a v-on:click="logout" href="#" class="orange-text">logout</a>
		</span>
		<span class="right">
			<a href="https://github.com/bellingcat/auto-archiver-extension/issues" target="_blank">Issue tracker</a>
			version {{ version }}
		</span>
	</p>
</template>

<script>
import M from 'materialize-css';
import TaskItem from './TaskItem.vue';

export default {
	data() {
		return {
			login: false,
			tasks: {},
			onlineTasks: [],
			isSearchingOnline: false,
			search: '',
			errorMessage: '',
			public: true,
			tagsChips: null,
			version: chrome.runtime.getManifest().version,
		};
	},
	methods: {
		archive: function (_, searchTerm) {
			(async () => {
				console.log(this.tags)
				const response = await this.callBackground({ action: "archive", optionalUrl: searchTerm });
				if (!response) return;
				this.url = response.url;
				this.id = response.id;
				this.addTask(response)
			})();
		},
		checkArchive: function () {
			(async () => {
				const response = await this.callBackground({ action: "getCurrentUrl" });
				if (!response) return;
				this.search = response;
				this.$refs.search.focus();
				this.searchTasks();
			})();
		},
		displayAllTasks: function () {
			(async () => {
				const response = await this.callBackground({ action: "getTasks" });
				if (!response) return;
				this.tasks = response;
			})();
		},
		syncLocalTasks: function () {
			(async () => {
				const tasks = await this.callBackground({ action: "syncLocalTasks" });
				if (!tasks) return;
				this.tasks = tasks;
				M.toast({ html: `sync complete: ${this.localTasksLength} task${this.localTasksLength != 1 ? 's' : ''} available`, classes: "green accent-4" });
			})();
		},
		oauthLogin: function (_, interactive) {
			(async () => {
				if (interactive) {
					M.toast({ html: "please complete the login on the popup window" });
				}
				const loginResult = await this.callBackground({ action: "oauthLogin", interactive });
				if (loginResult === null) return;
				this.login = loginResult.success;
				if (interactive) {
					if (loginResult.success) {
						M.toast({ html: "login success", classes: "green accent-4" });
					} else {
						M.toast({ html: `login failed: ${loginResult.message}`, classes: "red darken-1" });
					}
				}
			})();
		},
		logout: function () {
			(async () => {
				const logoutResult = await this.callBackground({ action: "logout" });
				if (logoutResult === null) return;
				if (logoutResult) {
					this.login = false;
					this.tasks = {};
				}
			})();
		},
		clearErrorMessage: function () {
			setTimeout(async () => {
				this.errorMessage = "";
				await this.callBackground({ action: "setErrorMessage", errorMessage: this.errorMessage });
			}, 3000)
		},
		displayErrorMessage: function () {
			(async () => {
				this.errorMessage = await this.callBackground({ action: "getErrorMessage" });
				this.clearErrorMessage()
			})();
		},
		addTask: function (task) {
			this.tasks[task.id] = task;
		},
		deleteTask: async function (taskId) {
			const tasksAfterDelete = await this.callBackground({ action: "deleteTask", taskId });
			if (tasksAfterDelete === null) return;
			this.tasks = tasksAfterDelete;
			M.toast({ html: `archive task deleted`, classes: "green accent-4" });
		},
		searchTasks: function () {
			console.log(`searching tasks? ${!this.isSearchingOnline}`);
			if (this.isSearchingOnline) {
				console.log(`skipping search, another is still active`);
				return;
			}
			if (this.search.length <= 3) {
				this.onlineTasks = [];
				return;
			}
			(async () => {
				this.isSearchingOnline = true;
				try {
					const onlineTasks = await this.callBackground({ action: "search", query: this.search });
					if (!onlineTasks) return;
					this.onlineTasks = (onlineTasks || []).filter(task => !Object.keys(this.tasks).includes(task.id))
				} finally {
					this.isSearchingOnline = false;
				}
			})();
		},
		callBackground: async function (parameters) {
			try {
				const answer = await chrome.runtime.sendMessage(parameters);
				if (answer.status == "error") {
					console.error(`showing error to user: ${JSON.stringify(answer.result)}`)
					M.toast({ html: `Error: ${answer.result}`, classes: "red darken-1", completeCallback: this.clearErrorMessage })
					return null;
				} else {
					return answer.result;
				}
			} catch (e) {
				console.error(e);
				if (parameters.action == "search") this.isSearchingOnline = false;
				return null;
			}
		},
		openTab: function (_, url) {
			chrome.tabs.create({ url });
		}
	},
	computed: {
		displayTasks() {
			return Object.values(this.tasks)
				.filter(t => t?.url.toLowerCase().includes(this.search.toLowerCase()))
				.sort((t1, t2) => (t1?.result?._processed_at || 0) - (t2?.result?._processed_at || 0)).slice(0, 25)
		},
		noSearchResults() {
			return this.search.length > 3 && !this.isSearchingOnline && Object.keys(this.onlineTasks).length == 0 && Object.keys(this.displayTasks).length == 0;
		},
		localTasksShownLength() {
			return Object.keys(this.displayTasks).length > 0;
		},
		localTasksLength() {
			return Object.keys(this.tasks).length;
		},
		onlineTasksLength() {
			return Object.keys(this.onlineTasks).length > 0;
		},
		tags() {
			return this?.tagsChips?.chipsData;
		}
	},
	mounted() {
		M.AutoInit();
		this.displayAllTasks();
		this.oauthLogin(false);
		this.displayErrorMessage();
		this.tagsChips = M.Chips.getInstance((document.querySelector('#tagChips')));
	},
	created() { },
	components: {
		TaskItem
	}
};
</script>
