
import optionsStorage from './options-storage.js';
import { getReasonPhrase } from 'http-status-codes';

const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:8004';

console.log(`API_ENDPOINT=${API_ENDPOINT}`)

const LOGIN_FAILED = `Please login before using this feature.`;

chrome.runtime.onMessage.addListener(((r, s, sendResponse) => {
	processMessages(r, s)
		.then(response => {
			// console.log(`SUCCESS (${r.action}): ${JSON.stringify(response).slice(0,50)}`)
			console.log(`SUCCESS (${r.action}): ${JSON.stringify(response)}`)
			sendResponse({ status: "success", result: response })
		}
		).catch(error => {
			let message = error.message == "Failed to fetch" ? `Unable to call the API: ${error.message}` : error.message;
			console.log(`ERROR (${r.action}): ${error}`)
			setErrorMessage(message);
			sendResponse({ status: "error", result: message })
		});
	return true; // Needed for sendResponse to be async
}));

function processMessages(request, sender) {

	return new Promise(async (resolve, reject) => {
		console.info(`action {${request.action}} from ${sender.tab ? 'content-script (' + sender.tab.url + ')' : 'the extension'}`);

		switch (request.action) {
			case 'home': {
				callHome(resolve, reject);
				break;
			}
			case 'getPermissions': {
				getPermissions(resolve, reject);
				break;
			}
			case 'getEndpoint': {
				if (API_ENDPOINT === 'http://localhost:8004') {
					resolve("http://localhost:8081")
				}
				resolve(API_ENDPOINT.replace('-api', ''));
				break;
			}
			case 'archive': {
				archiveUrl(resolve, reject, request.optionalUrl, request.archiveCreate);
				break;
			}
			case 'status': {
				const taskDb = await getTaskById(request.task.id);
				if (taskDb?.status === 'SUCCESS' || taskDb?.status === 'FAILURE' || taskDb?.status === 'REVOKED') {
					console.log('ALREADY FINISHED, NO REQS');
					resolve(taskDb);
				} else {
					resolve(await checkTaskStatus(resolve, reject, request.task));
				}
				break;
			}
			case 'getTasks': {
				resolve(await getAllTasks());
				break;
			}
			case 'getErrorMessage': {
				resolve(await getErrorMessage());
				break;
			}
			case 'setErrorMessage': {
				await setErrorMessage(request.errorMessage)
				break;
			}
			case 'getCurrentUrl': {
				getUrl(resolve, reject);
				break;
			}
			case 'oauthLogin': {
				oauthLogin(resolve, reject, request.interactive);
				break;
			}
			case 'logout': {
				logout(resolve, reject);
				break;
			}
			// No default
		}

	});
}


function getUrl(resolve, reject) {
	chrome.tabs.query({
		active: true,
		lastFocusedWindow: true,
	}, async tabs => {
		const url = tabs[0].url;
		resolve(url);
	});
}


function oauthLogin(resolve, reject, interactive) {
	try {
		// force re-auth if interactive is needed
		if (interactive) {
			chrome.identity.clearAllCachedAuthTokens();
		}
		chrome.identity.getAuthToken({ interactive: interactive }, async accessToken => {
			console.warn(`GOT token ${accessToken}`);
			if (accessToken === undefined) { resolve({ success: false, message: "Could not get access token." }); }
			resolve({ success: true });
		});
	} catch (e) {
		console.error(`LOGIN FAILED: ${e}`);
		resolve({ success: false, message: `Login failed: ${e}` });
	}
}


function logout(resolve, reject) {
	chrome.identity.clearAllCachedAuthTokens();
	resolve(true);
}

function callHome(resolve, reject) {
	chrome.identity.getAuthToken({ interactive: false }, async accessToken => {
		return new Promise(() => {
			fetch(API_ENDPOINT, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`
				}
			})
				.then(getJsonOrError)
				.then(response => resolve(response))
				.catch(e => reject(e));
		});
	});
}

function getPermissions(resolve, reject) {
	chrome.identity.getAuthToken({ interactive: false }, async accessToken => {
		return new Promise(() => {
			fetch(`${API_ENDPOINT}/user/permissions`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
				}
			})
				.then(getJsonOrError)
				.then(response => resolve(response))
				.catch(e => reject(e));
		});
	});
}

function archiveUrl(resolve, reject, optionalUrl, archiveCreate) {
	chrome.identity.getAuthToken({ interactive: false }, async accessToken => {
		if (accessToken == undefined) {
			reject(new Error(LOGIN_FAILED));
			return;
		}
		chrome.tabs.query({
			active: true,
			lastFocusedWindow: true,
		}, async tabs => {
			archiveCreate.url = optionalUrl || tabs[0].url;
			console.log(`archiveCreate=${JSON.stringify(archiveCreate)}`);
			submitUrlArchive(archiveCreate, accessToken).then(async response => {
				const newArchive = { url: archiveCreate.url, id: response.id, status: 'PENDING', result: {} };
				await upsertTask(newArchive);
				resolve(newArchive);
			}).catch(e => reject(e));
		});
	});
}

function submitUrlArchive(archiveCreate, accessToken) {
	console.log('API: SUBMIT');
	return new Promise((resolve, reject) => {
		fetch(`${API_ENDPOINT}/url/archive`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${accessToken}`
			},
			body: JSON.stringify(archiveCreate),
		})
			.then(getJsonOrError)
			.then(response => resolve(response))
			.catch(e => reject(e));
	});
}

function checkTaskStatus(resolve, reject, task) {
	console.log('API: STATUS');
	return new Promise((InnerResolve, innerReject) => {
		chrome.identity.getAuthToken({ interactive: false }, async accessToken => {
			if (accessToken == undefined) {
				reject(new Error(LOGIN_FAILED));
				return;
			}
			fetch(`${API_ENDPOINT}/task/${task.id}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`
				},
			})
				.then(getJsonOrError)
				.then(response => {
					const new_task = {
						url: task.url,
						id: response.id,
						status: response.status,
						result: typeof response.result == "object" ? response.result : JSON.parse(response.result),
					};
					console.log(`status ${new_task.url}: ${new_task.id}`);
					(async () => {
						await upsertTask(new_task);
						InnerResolve(new_task);
					})();
				})
				.catch(e => reject(e));
		});
	});
}


async function getJsonOrError(response) {
	let additionalErrorInfo = "";
	if (response.status == 401) additionalErrorInfo = `Check that this email has been granted permission.`;
	if (response.status != 200 && response.status != 201) throw new Error(`${response.status}: ${getReasonPhrase(response.status)} ${additionalErrorInfo}`);
	return await response.json();
}

async function getAllTasks() {
	const storage = await optionsStorage.getAll();
	console.log(`OP: GET_ALL, has ${Object.keys(storage.archivedUrls).length} entries`)
	return storage.archivedUrls;
}

async function upsertTask(task) {
	const storage = await optionsStorage.getAll();
	storage.archivedUrls[task.id] = task;
	await optionsStorage.set(storage);
}

async function getTaskById(task) {
	const storage = await optionsStorage.getAll();
	return storage.archivedUrls[task.id];
}

async function getErrorMessage() {
	const storage = await optionsStorage.getAll();
	console.log(`OP: GET_ERROR_MESSAGE has '${storage.errorMessage}'`)
	return storage.errorMessage;
}

async function setErrorMessage(errorMessage) {
	const storage = await optionsStorage.getAll();
	storage.errorMessage = errorMessage;
	await optionsStorage.set(storage);
}
