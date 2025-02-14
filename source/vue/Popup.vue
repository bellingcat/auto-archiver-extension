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
	<h5 class="center-s section-title">
		Archive or look for archives of this page
	</h5>
	<div v-if="errorMessage.length" class="red lighten-2">Error: {{ errorMessage }}</div>
	<div v-if="can_archive_url === false" class="red lighten-2">
		You don't have permission to archive URLs.
		Please visit the <a href="https://auto-archiver.bellingcat.com" target="_blank">auto-archiver.bellingcat.com</a>
		to request access.
	</div>


	<div id="archive-modal">
		<div class="modal-content" style="display: flex; align-items: center; gap: 10px;">
			<span class="switch">
				<!-- <span class="form-guide">Visibility:</span> -->
				<label>
					private
					<input type="checkbox" v-model="_public">
					<span class="lever"></span>
					public
				</label>
			</span>
			<span class="input-field col s12">
				<select class="browser-default" v-model="group" style="background: #e3e3e3;padding: 5px;">
					<option v-for="g in availableGroups" :value="g">{{ g }}</option>
				</select>
			</span>
			<button class="tooltipped waves-effect waves-light btn" style="margin-left: auto;"
				:class="archiveReady && login ? '' : 'disabled'" data-position="bottom" data-tooltip="Archive this URL"
				v-on:click="archive($event)">
				<i class="material-icons left">cloud</i> Archive
			</button>
			<button v-on:click="checkArchive" class="tooltipped waves-effect waves-light btn flat light-blue darken-3"
				style="margin-left: auto;" data-position="bottom" data-tooltip="Check if this URL has been archived">
				<i class="material-icons left">search</i> lookup
			</button>
		</div>
	</div>
	<hr>
	<table class="archive-results" v-if="localTasksShownLength > 0">
		<thead>
			<tr class="row">
				<th class="col s1"></th>
				<th class="col s5">URL</th>
				<th class="col s2">Result</th>
				<th class="col s3">Archive date</th>
			</tr>
		</thead>
		<tbody>
			<TaskItem v-for="t in displayTasks" :key="t.id" :initial-task="t" taskType="local" @remove="deleteTask" />
		</tbody>
	</table>
	<div style="height:100%"></div>
	<p style="font-size: 1.2em; text-align: center;">
		Visit <a href="https://auto-archiver.bellingcat.com" target="_blank">auto-archiver.bellingcat.com</a> for more
		features.
	</p>
	<p>
		<span>
			<img src="../img/ben-archiver.png" alt="icon" id="icon" style="margin-right: 5px;">
			auto-archiver extension <a href="https://github.com/bellingcat/auto-archiver-extension/" target="_blank">v {{ version }}</a>
			|
			<a href="https://github.com/bellingcat/auto-archiver-extension/issues" target="_blank">Issue tracker</a>
		</span>
		<span v-if="login" class="right">
			<a v-on:click="logout" href="#" class="orange-text">logout</a>
		</span>
	</p>
</template>

<script>
import M from 'materialize-css';
import TaskItem from './TaskItem.vue';

export default {
	data() {
		return {
			tasks: {},
			endpoint: "",
			login: false,
			can_archive_url: undefined,
			permissions: {},
			errorMessage: '',
			_public: false,
			group: "",
			availableGroups: [],
			version: chrome.runtime.getManifest().version,
		};
	},
	methods: {
		/**
		 * Calls base endpoint '/' to check for errorMessage and groups
		 * @param {*} _
		 */
		callHome: function (_) {
			(async () => {
				const response = await this.callBackground({ action: "home" });
				if (!response) return;
				console.log(`HOME STATUS = ${response}`)
				if (response?.breakingChanges?.minVersion > this.version) {
					M.toast({ html: `${response.breakingChanges.message} (minimum version is ${response.breakingChanges.minVersion})`, classes: "light-blue darken-2" });
				}
				if (response.groups) { this.groups = response.groups }
			})();
		},
		loadPermissions: function () {
			(async () => {
				const permissions = await this.callBackground({ action: "getPermissions" });
				console.log(`permissions: ${JSON.stringify(permissions)}`)
				if (!permissions) return;
				this.permissions = permissions;
				this.can_archive_url = permissions.all.archive_url;
				if (!this.can_archive_url) {
					return;
				}
				this.availableGroups = Object.keys(permissions).filter(p => p != "all").filter(g => permissions[g].archive_url);
			})();
		},
		archive: function (_, searchTerm) {
			(async () => {
				const currentUrl = await this.callBackground({ action: "getCurrentUrl" }) ?? "";
				// this.openTab(null, `${this.endpoint}/url?url=${response}`);
				const result = await this.callBackground({
					action: "archive",
					url: currentUrl,
					archiveCreate: {
						_public: this._public, group: this.group, tags: []
					}
				});
				if (!result) return;
				M.toast({ html: `archive started with id ${result.id}`, classes: "green accent-4" });
				this.addTask(result)
			})();
		},
		checkArchive: function () {
			(async () => {
				const response = await this.callBackground({ action: "getCurrentUrl" }) ?? "";
				//TODO: fix this
				this.openTab(null, `${this.endpoint}/archives?url=${response}`);
			})();
		},
		displayAllTasks: function () {
			(async () => {
				const response = await this.callBackground({ action: "getTasks" });
				if (!response) return;
				this.tasks = response;
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
						return;
					}
				}
				this.callHome();
				this.loadPermissions();
			})();
		},
		setEndpoint: function () {
			(async () => {
				this.endpoint = await this.callBackground({ action: "getEndpoint" });
			})();
		},
		logout: function () {
			(async () => {
				const logoutResult = await this.callBackground({ action: "logout" });
				if (logoutResult === null) return;
				if (logoutResult) {
					this.login = false;
					this.tasks = {};
					this.availableGroups = [];
					this.can_archive_url = undefined;
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
				.sort((t1, t2) => (t1?.result?._processed_at || 0) - (t2?.result?._processed_at || 0)).slice(0, 25)
		},
		localTasksShownLength() {
			return Object.keys(this.displayTasks).length > 0;
		},
		archiveReady() {
			return this.group != undefined && this.availableGroups.includes(this.group);
		}
	},
	mounted() {
		M.AutoInit();
		this.setEndpoint();
		this.displayAllTasks();
		this.oauthLogin(false);
		this.displayErrorMessage();
	},
	created() { },
	components: {
		TaskItem
	}
};
</script>
