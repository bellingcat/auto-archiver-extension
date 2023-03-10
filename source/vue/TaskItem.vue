<template>
	<tr class="row">
		<td class="col s1">
			<div v-if="taskPending" class="preloader-wrapper small active">
				<div class="spinner-layer ">
					<div class="circle-clipper left">
						<div class="circle"></div>
					</div>
					<div class="gap-patch">
						<div class="circle"></div>
					</div>
					<div class="circle-clipper right">
						<div class="circle"></div>
					</div>
				</div>
			</div>
			<div v-if="taskSucceeded">
				<i v-if="taskType == 'online'" title="found on the cloud"
					class="material-icons small green-text darken-4">cloud_done</i>
				<i v-if="taskType == 'local'" title="found locally"
					class="material-icons small green-text darken-4">done</i>
			</div>
			<div v-if="taskFailed">
				<i class="material-icons small red-text darken-4">clear</i>
			</div>
		</td>
		<td class="col s5"><a :href="task?.url" target="_blank">{{ task.url }}</a></td>
		<td class="col s2"><a v-if="archiveUrl.length" :href="archiveUrl" target="_blank">{{ task?.result?.status || "open"
		}}</a><span v-if="!archiveUrl.length">{{ task?.result?.status || 'no result' }}</span></td>
		<td class="col s3">{{ readbleDate }}</td>
		<td class="col s1" v-if="(taskFailed || taskSucceeded) && taskType == 'local'">
			<a class="delete-btn" href="#" v-on:click="deleteTask"><i class="material-icons small">delete</i></a>
		</td>
	</tr>
</template>
<style>
.delete-btn {
	color: grey;
}

.delete-btn:hover {
	color: darkred;
}
</style>

<script>
export default {
	name: 'TaskItem',
	props: ['initialTask', 'taskType'],
	data() {
		return {
			task: this.initialTask
		}
	},
	methods: {
		checkStatus: function () {
			console.log(`Checking status task id=${JSON.stringify(this.task?.id)}`);
			if (this.taskFinished(this.task)) return
			this.intervalId = setInterval(function () {
				this.callBackground(
					{ action: "status", task: this.task }
				).then(updated_task => {
					if (this.taskFinished(updated_task)) {
						clearInterval(this.intervalId);
						this.task = updated_task
					}
				});
			}.bind(this), 2500);
		},
		deleteTask: function () {
			this.$emit('remove', this.task.id);
		},
		taskFinished: function (task) {
			return task.status == 'SUCCESS' || task.status == 'FAILURE' || task.status == 'REVOKED';
		},
		callBackground: async function (parameters) {
			try {
				const answer = await chrome.runtime.sendMessage(parameters);
				if (answer.status == "error") {
					console.error(`error: ${answer.result}`)
					M.toast({ html: `Error: ${answer.result}`, classes: "red darken-1" })
					return null;
				} else {
					return answer.result;
				}
			} catch (e) {
				console.error(e);
				return null;
			}
		}
	},
	computed: {
		archiveUrl() {
			return this.task?.result?.media?.filter(m => m?.properties?.id == "_final_media")?.at(0)?.urls?.at(0) || '';
		},
		readbleDate() {
			if (this.task?.result?._processed_at) {
				return new Date(this.task.result._processed_at * 1e3).toISOString().slice(0, 19);
			}
		},
		taskPending() {
			return this.task.status == 'PENDING';
		},
		taskSucceeded() {
			return this.task.status == 'SUCCESS';
		},
		taskFailed() {
			return !this.taskSucceeded && !this.taskPending;
		}
	},
	mounted() {
		this.checkStatus();
	}
}
</script>
