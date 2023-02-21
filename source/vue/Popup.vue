<template>
    <h5>
        <img src="../img/icon.png" alt="icon" id="icon">
        Auto Archiver extension
        <button v-on:click="archive" class="waves-effect waves-light btn-small right">Archive!</button>
    </h5>
    <div class="input-field col s6">
        <i class="material-icons prefix">search</i>
        <input id="icon_prefix" type="text" v-model="search">
        <label for="icon_prefix">Search for URLs</label>
    </div>
    <table id="archiveResults">
        <thead>
            <tr class="row">
                <th class="col s1"></th>
                <th class="col s5">URL</th>
                <th class="col s2">Result</th>
                <th class="col s3">Date</th>
            </tr>
        </thead>
        <tbody>
            <TaskItem v-for="t in displayTasks" :key="t.task_id" :initial-task="t" />
        </tbody>
    </table>
</template>


<script>
import M from 'materialize-css';
import TaskItem from './TaskItem.vue';

export default {
    data() {
        return {
            tasks: [],
            isLoading: false,
            search: ''
        };
    },
    methods: {
        archive: function () {
            // M.toast({html: 'DONE'})

            // chrome.tabs.sendMessage
            this.isLoading = !this.isLoading;
            (async () => {
                const response = await chrome.runtime.sendMessage({
                    action: "archive"
                });
                // do something with response here, not outside the function
                this.url = response.url;
                this.task_id = response.task_id;
                this.addTask(response)
            })();
        },
        displayAllTasks: function () {
            (async () => {
                const tasks = await chrome.runtime.sendMessage({
                    action: "getTasks"
                });
                console.log(tasks)
                this.tasks = tasks;
            })();
        },
        addTask: function (task) {
            this.tasks[task.task_id] = task;
        }
    },
    computed: {
        displayTasks() {
            let st = Object.values(this.tasks)
                .filter(t => t?.url.toLowerCase().includes(this.search.toLowerCase()))
                .sort((t1, t2) => (t1?.result?._processed_at || 0) - (t2?.result?._processed_at || 0)).slice(0, 25)
            return st
        }
    },
    mounted() {
        M.AutoInit()
        this.displayAllTasks()
    },
    created() { },
    components: {
        TaskItem
    }
};
</script>