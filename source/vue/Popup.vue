<template>
    <p v-if="!login">please <a v-on:click="oauthLogin" href="#">login</a> into your google account</p>
    <div v-if="errorMessage.length" class="red darken-1 white-text">Error: {{ errorMessage }}</div>
    <h5>
        <img src="../img/ben-archiver.png" alt="icon" id="icon">
        auto-archiver extension
        <button v-on:click="archive" class="tooltipped waves-effect waves-light btn-small right" data-position="bottom"
            data-tooltip="Archive this URL">
            <i class="material-icons left">cloud</i> Archive!</button>
        <button v-on:click="checkArchive"
            class="tooltipped waves-effect waves-light btn-small right flat light-blue darken-3" style="margin-right:10px;"
            data-position="bottom" data-tooltip="Check if this URL has been archived">lookup URL</button>
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
        No results... do you want to <a v-on:click="archiveFromSearch" href="#">archive</a>?
    </div>
    <p v-show="login">
        <a href="#" v-on:click="syncLocalTasks" class="tooltipped"
            data-tooltip="updates local database with entries submitted by the current user" data-position="top">Sync</a>
        my cloud archives.
    </p>
    <small>
        <span v-if="login">Hello {{ login }}!</span>
        <span class="right"><a href="https://github.com/bellingcat/auto-archiver-extension/issues" target="_blank">Issue
                tracker</a> version {{ version }}</span>
    </small>
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
            version: chrome.runtime.getManifest().version
        };
    },
    methods: {
        archive: function () {
            (async () => {
                const response = await this.callBackground({ action: "archive" });
                if (!response) return;
                this.url = response.url;
                this.id = response.id;
                this.addTask(response)
            })();
        },
        archiveFromSearch: function () {
            //TODO: how to deduplicate? calling archive(this.search) is bad because of default injections into archive
            (async () => {
                const response = await this.callBackground({ action: "archive", optionalUrl: this.search });
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
                console.log("SYNC")
                const tasks = await this.callBackground({ action: "syncLocalTasks" });
                console.log(`TASKS: ${JSON.stringify(tasks)}`)
                if (!tasks) return;
                this.tasks = tasks;
                M.toast({ html: `sync complete: ${this.localTasksLength} task${this.localTasksLength != 1 ? 's' : ''} available`, classes: "green accent-4" });
            })();
        },
        displayLogin: function () {
            (async () => {
                const response = await this.callBackground({ action: "getProfileEmail" });
                if (!response) {
                    this.login = false;
                } else {
                    this.login = response.email;
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
        oauthLogin: function () {
            (async () => {
                const loginSuccessful = await this.callBackground({ action: "oauthLogin" });
                if (loginSuccessful === null) return;
                M.toast({ html: loginSuccessful ? "login success" : "login failed", classes: loginSuccessful ? "green accent-4" : "red darken-1" });
                if (loginSuccessful) { this.displayLogin(); }
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
    },
    mounted() {
        M.AutoInit();
        this.displayAllTasks();
        this.displayLogin();
        this.displayErrorMessage();
    },
    created() { },
    components: {
        TaskItem
    }
};
</script>