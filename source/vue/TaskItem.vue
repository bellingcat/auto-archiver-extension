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
		<td class="col s2">
			<div v-if="archiveUrls.length > 1">{{ task?.result?.status || "success" }}:</div>
			<div v-for="au in archiveUrls">
				<a :href="au.url" target="_blank" :title="`${au.id}: ${au.url}`">
					{{ archiveUrls.length == 1 ? (task?.result?.status || "success") : au.id }}
				</a>
			</div>
			<span v-if="!archiveUrls.length">{{ task?.result?.error || 'no result' }}</span>
		</td>
		<td class="col s3">{{ readbleDate }}</td>
		<td class="col s1">
			<a class="delete-btn" v-if="(taskFailed || taskSucceeded) && taskType == 'local'" href="#"
				v-on:click="deleteTask"><i class="material-icons small">delete</i></a>
			<a class="download-btn" v-if="taskSucceeded" href="#" v-on:click="downloadTask"><i
					class="material-icons small" title="Download JSON data">data_object</i></a>
		</td>
	</tr>
</template>
<style>
.delete-btn,
.download-btn {
	color: grey;
}

.delete-btn:hover {
	color: darkred;
}

.download-btn:hover {
	color: teal;
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
		downloadTask: function () {
			const json = JSON.stringify(this.task);
			const blob = new Blob([json], { type: 'application/json' });
			const blobUrl = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = `task-${this.task?.id}.json`;
			a.style.display = 'none';

			document.body.appendChild(a);
			a.click();

			// Clean up
			document.body.removeChild(a);
			URL.revokeObjectURL(blobUrl);
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
		/**
		 * Tries to extract the _final_media archive URL, but will return a list of URLs in case that one is not present and others are, this is needed since some older archives don't have an html page but rather a video/screenshot.
		 */
		archiveUrls() {
			let urlsToShow = [this.task?.result?.media?.filter(m => m?.properties?.id == "_final_media")?.at(0)].filter(m => m !== undefined);
			urlsToShow = urlsToShow.length ? urlsToShow : this.task?.result?.media || [];
			urlsToShow = urlsToShow.map(m => { return { url: m?.urls?.at(0), id: m?.properties?.id } }).filter(m => m.url !== undefined);
			return urlsToShow;
		},
		readbleDate() {
			if (this.task?.result?.metadata?._processed_at) {
				return new Date(this.task.result.metadata._processed_at * 1e3).toISOString().slice(0, 19);
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
