<template>
	<tr class="row">
		<td class="col s1">
			<div v-if="task.status == 'PENDING'" class="preloader-wrapper small active">
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
			<div v-if="task.status == 'SUCCESS'">
				<i class="material-icons small green-text darken-4">done</i>
			</div>
			<div v-if="task.status == 'FAILURE'">
				<i class="material-icons small red-text darken-4">clear</i>
			</div>
		</td>
		<td class="col s5"><a :href="task?.url">{{ task.url }}</a></td>
		<td class="col s2"><a v-if="archiveUrl.length" :href="archiveUrl" target="_blank">{{ task?.result?.status || "open" }}</a> </td>
		<td class="col s3">{{ readbleDate }}</td>
	</tr>
</template>

<script>
export default {
	name: 'TaskItem',
	props: ['initialTask'],
	data() {
		return {
			task: this.initialTask
		}
	},
	methods: {
		checkStatus: function () {
			console.log(this.task)
			if (this.taskFinished(this.task)) return
			this.intervalId = setInterval(function () {
				chrome.runtime.sendMessage({
					action: "status",
					task: this.task
				}).then(updated_task => {
					console.log(updated_task)
					if (this.taskFinished(updated_task)) {
						clearInterval(this.intervalId);
						this.task = updated_task
					}
				})
			}.bind(this), 2500);
		},
		taskFinished: function (task) {
			return task.status == 'SUCCESS' || task.status == 'FAILURE';
		}
	},
	computed: {
		archiveUrl() {
			// return this.task?.result?.media?.urls.at(0) || '';
			console.log(this.task?.result?.media);
			console.log(this.task?.result?.media?.filter(m=>m?.properties?.id=="_final_media"));
			console.log(this.task?.result?.media?.filter(m=>m?.properties?.id=="_final_media")?.urls?.at(0));
			return this.task?.result?.media?.filter(m=>m?.properties?.id=="_final_media")?.at(0)?.urls?.at(0) || '';
		},
		readbleDate() {
			if (this.task?.result?._processed_at) {
				return new Date(this.task.result._processed_at * 1e3).toISOString().slice(0, 19);
			}
		}
	},
	mounted() {
		this.checkStatus();
	}
}
</script>