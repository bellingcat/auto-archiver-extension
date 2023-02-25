
// Import './options-storage.js';
import optionsStorage from './options-storage.js';

// TODO: stable ID https://developer.chrome.com/docs/extensions/mv3/tut_oauth/
const API_ENDPOINT = 'http://localhost:8004/tasks'
// const API_ENDPOINT = 'http://134.122.58.133:8004/tasks';

chrome.runtime.onMessage.addListener(((r, s, sR) => {
	processMessages(r, s, sR);
	return true; // Needed for sendResponse to be async
}));

async function processMessages(request, sender, sendResponse) {
	console.info(`action {${request.action}} from ${sender.tab ? 'content-script (' + sender.tab.url + ')' : 'the extension'}`);
	chrome.identity.getAuthToken({ interactive: true }, async accessToken => {
		switch (request.action) {
			case 'archive': {
				archiveUrl(sendResponse, accessToken);
				break;
			}
			case 'search': {
				const tasks = await search(request.query, accessToken);
				sendResponse(tasks);
				break;
			}
			case 'status': {
				const taskDb = await getTaskById(request.task.task_id);
				if (taskDb?.status === 'SUCCESS' || taskDb?.status === 'FAILURE'|| taskDb?.status === 'REVOKED') {
					console.log('ALREADY FINSIHED, NO REQS');
					sendResponse(taskDb);
				} else {
					const taskFresh = await checkTaskStatus(request.task, accessToken);
					sendResponse(taskFresh);
				}
				break;
			}
			case 'getTasks': {
				sendResponse(await getAllTasks());
				break;
			}
			// No default
		}
	});
}

function archiveUrl(sendResponse, accessToken) {
	chrome.tabs.query({
		active: true,
		lastFocusedWindow: true,
	}, async tabs => {
		const url = tabs[0].url;
		console.log(`url=${url}`);
		const response = await searchTask(url, accessToken);
		const newArchive = { url, task_id: response.task_id, status: 'PENDING', result: {} };
		await upsertTask(newArchive);
		sendResponse(newArchive);
	});
}

function searchTask(url, accessToken) {
	console.log('API: SUBMIT');
	return new Promise((resolve, reject) => {
		fetch(API_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ url, access_token: accessToken }),
		}).then(
			response => response.json(),
		).then(response => resolve(response),
		).catch(error => {
			console.log(`There was an error: ${error}`);
			reject(error);
		});
	});
}

function checkTaskStatus(task, accessToken) {
	console.log('API: STATUS');
	return new Promise((resolve, reject) => {
		fetch(`${API_ENDPOINT}/${task.task_id}?` + new URLSearchParams({ access_token: accessToken }), {
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
				result: typeof response.task_result == "object" ? response.task_result : JSON.parse(response.task_result),
			};
			console.log(`status ${new_task.url}: ${new_task.task_id}`);
			upsertTask(new_task);
			resolve(new_task);
		},
		).catch(error => reject(error));
	});
}

function search(query, accessToken) {
	console.log('API: SEARCH');
	return new Promise((resolve, reject) => {
		fetch(`${API_ENDPOINT}/search?` + new URLSearchParams({ access_token: accessToken, query }), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		}).then(
			response => response.json(),
		).then(response => resolve(response),
		).catch(error => {
			console.log(`There was an error: ${error}`);
			reject(error);
		});
	});
}

async function getAllTasks() {
	const storage = await optionsStorage.getAll();
	return storage.archivedUrls;
}

// TODO: improve with less reads from storage
async function upsertTask(task) {
	const storage = await optionsStorage.getAll();
	storage.archivedUrls[task.task_id] = task;
	await optionsStorage.set(storage);
}

async function getTaskById(task) {
	const storage = await optionsStorage.getAll();
	return storage.archivedUrls[task.task_id];
}
