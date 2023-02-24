// eslint-disable-next-line import/no-unassigned-import
// import './options-storage.js';
import optionsStorage from './options-storage.js';

// TODO: stable ID https://developer.chrome.com/docs/extensions/mv3/tut_oauth/
// TODO: API_ENDPOINT depending on deployment
const API_ENDPOINT = 'http://localhost:8000/tasks'

chrome.runtime.onMessage.addListener(((r, s, sR) => {
	processMessages(r, s, sR)
	return true; // needed for sendResponse to be async
}));

async function processMessages(request, sender, sendResponse) {
	console.info(`action {${request.action}} from ${sender.tab ? 'content-script (' + sender.tab.url + ')' : 'the extension'}`)
	chrome.identity.getAuthToken({ interactive: true }, async function (access_token) {
		console.log(access_token);
		if (request.action === "archive") {
			archiveUrl(sendResponse, access_token);
		} else if (request.action === "search") {
			const tasks = await search(request.query, access_token);
			sendResponse(tasks);
		} else if (request.action === "status") {
			const task_db = await getTaskById(request.task.task_id);
			if (task_db?.status == "SUCCESS" || task_db?.status == 'FAILURE') {
				console.log("ALREADY FINSIHED, NO REQS")
				sendResponse(task_db)
			}
			const task_fresh = await checkTaskStatus(request.task, access_token)
			sendResponse(task_fresh)
		} else if (request.action === "getTasks") {
			sendResponse(await getAllTasks());
		}
	});
}

function archiveUrl(sendResponse, access_token) {
	chrome.tabs.query({
		active: true,
		lastFocusedWindow: true
	}, async (tabs) => {
		let url = tabs[0].url;
		console.log(`url=${url}`);
		const response = await searchTask(url, access_token);
		const new_archive = { url, task_id: response.task_id, status: 'PENDING', result: {} };
		await upsertTask(new_archive);
		sendResponse(new_archive);
	});
}

function searchTask(url, access_token) {
	console.log(`API: SUBMIT`)
	return new Promise((resolve, reject) => {
		fetch(API_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ url, access_token }),
		}).then(
			response => response.json(),
		).then(response => resolve(response)
		).catch(err => {
			console.log(`There was an error: ${err}`)
			reject(err)
		});
	})
}

function checkTaskStatus(task, access_token) {
	console.log(`API: STATUS`)
	return new Promise((resolve, reject) => {
		fetch(`${API_ENDPOINT}/${task.task_id}?` + new URLSearchParams({ access_token }), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		}).then(
			response => response.json(),
		).then(response => {
			const new_task = {
				url: task.url,
				task_id: response.task_id,
				status: response.task_status,
				result: JSON.parse(response.task_result),
			}
			console.log(new_task);
			upsertTask(new_task);
			resolve(new_task)
		}
		).catch(err => reject(err));
	})
}

function search(query, access_token) {
	console.log(`API: SEARCH`)
	return new Promise((resolve, reject) => {
		fetch(`${API_ENDPOINT}/search?` + new URLSearchParams({ access_token, query }), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		}).then(
			response => response.json(),
		).then(response => resolve(response)
		).catch(err => {
			console.log(`There was an error: ${err}`)
			reject(err)
		});
	})
}

async function getAllTasks() {
	const storage = await optionsStorage.getAll();
	return storage.archived_urls;
}

//TODO: improve with less reads from storage
async function upsertTask(task) {
	const storage = await optionsStorage.getAll();
	storage.archived_urls[task.task_id] = task;
	await optionsStorage.set(storage);
}

async function getTaskById(task) {
	const storage = await optionsStorage.getAll();
	return storage.archived_urls[task.task_id];
}