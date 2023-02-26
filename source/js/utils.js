// /**
//  * 
//  * 
// */
// export async function callBackground(parameters) {
// 	try {
// 		const answer = await chrome.runtime.sendMessage(parameters);
// 		if (answer.status == "error") {
// 			console.error(`error: ${answer.result}`)
// 			//TODO: modal/errors
// 			return null;
// 		} else {
// 			return answer.result;
// 		}
// 	} catch (e) {
// 		console.error(e);
// 		return null;
// 	}
// }