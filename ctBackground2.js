/*	Cold Turkey Blocker Chrome Extension v4.0
	Copyright (c) 2020 Cold Turkey Software Inc.
*/

var port;
var statsTimer;
var doubleCheckTimer;

var version = 1;

var diffBlockList = [];
var diffExceptList = [];
var diffTitleList = [];
var currentBlockList = [];
var currentExceptionList = [];
var currentTitleList = [];
var addableBlocks = [];

var statsEnabled = false;
var statsEnabledIncognito = false;
var statsActive = true;
var isPro = false;
var ignoreIncognito = false;
var forceAllowFile = false;
var blockInactive = false;
var blockCharity = false;
var blockEmbedded = false;
var statsStrict = false;
var firstMessage = true;
var totalEntries = 0;
var paused = "";

/* Legacy-only Variables */
var counter = 0;

/* Initialization */
try {
	port = chrome.extension.connectNative('com.coldturkey.coldturkey');
	port.onDisconnect.addListener(function() {
		currentBlockList = [];
		currentExceptionList = [];
		window.clearInterval(statsCheck);
	});
	doubleCheckTimer = window.setInterval(doubleCheck, 5000);
} catch (e) {
	console.log('Error starting Cold Turkey Blocker extension.');
}

/* Chrome Event Listeners */
chrome.browserAction.disable();
port.onMessage.addListener(function(list) {

	if (typeof list.version == 'string') {
		version = parseInt(list.version);
	} else if (typeof list.version == 'number') {
		version = list.version;		
	}
	if (version == 1) {
		port.postMessage('counter@' + counter + '@@Chrome');
		counter = 0;
	}
	if (version >= 1) {
		if (typeof list.blockList != 'undefined' && list.blockList != ''){
			var thisList = list.blockList.match(/(\\.|[^@])+/g);
			for(var i=0; i < thisList.length; i++) {
				thisList[i] = thisList[i].replace(/\\/g, '');
			}
			diffBlockList = thisList.diff(currentBlockList);
			currentBlockList = thisList.slice();
		} else {
			diffBlockList = [];
			currentBlockList = [];
		}
		if (typeof list.exceptionList != 'undefined' && list.exceptionList != '') {
			var thisList = list.exceptionList.match(/(\\.|[^@])+/g);
			for(var i=0; i < thisList.length; i++) {
				thisList[i] = thisList[i].replace(/\\/g, '');
			}
			diffExceptList = thisList.diff(currentExceptionList);
			currentExceptionList = thisList.slice();
		} else {
			diffExceptList = [];
			currentExceptionList = [];
		}
	}
	if (version >= 2) {
		if (typeof list.statsEnabled != 'undefined' && list.statsEnabled == 'true'){
			statsEnabled = true;
		} else {
			statsEnabled = false;
		}
		if (typeof list.statsEnabledIncognito != 'undefined' && list.statsEnabledIncognito == 'true'){
			statsEnabledIncognito = true;
		} else {
			statsEnabledIncognito = false;
		}
		if (typeof list.isPro != 'undefined' && (list.isPro == 'true' || list.isPro == 'pro' || list.isPro == 'trial')) {
			isPro = true;
		}
		if (typeof list.ignoreIncognito != 'undefined' && list.ignoreIncognito == 'true') {
			ignoreIncognito = true;
		}
	}
	if (version >= 4) {
		if (typeof list.forceAllowFile != 'undefined' && list.forceAllowFile == 'true'){
			forceAllowFile = true;
		} else {
			forceAllowFile = false;
		}
		if (typeof list.blockInactive != 'undefined' && list.blockInactive == 'true'){
			blockInactive = true;
		} else {
			blockInactive = false;
		}
		if (typeof list.blockCharity != 'undefined' && list.blockCharity == 'true'){
			blockCharity = true;
		} else {
			blockCharity = false;
		}
		if (typeof list.blockEmbedded != 'undefined' && list.blockEmbedded == 'true'){
			blockEmbedded = true;
		} else {
			blockEmbedded = false;
		}
		if (typeof list.statsStrict != 'undefined' && list.statsStrict == 'true'){
			statsStrict = true;
		} else {
			statsStrict = false;
		}
		if (typeof list.paused != 'undefined' && list.paused != 'false'){
			paused = list.paused;
		} else {
			paused = "";
		}
		if (typeof list.titleList != 'undefined' && list.titleList != ''){
			var thisList = list.titleList.match(/(\\.|[^@])+/g);
			for(var i=0; i < thisList.length; i++) {
				thisList[i] = thisList[i].replace(/\\/g, '');
			}
			diffTitleList = thisList.diff(currentTitleList);
			currentTitleList = thisList.slice();
		} else {
			diffTitleList = [];
			currentTitleList = [];
		}
		if (typeof list.addableBlocks != 'undefined' && list.addableBlocks != ''){
			addableBlocks = list.addableBlocks.match(/(\\.|[^@])+/g);
			for(var i=0; i < addableBlocks.length; i++) {
				addableBlocks[i] = addableBlocks[i].replace(/\\/g, '');
			}
		} else {
			addableBlocks = [];
		}
		chrome.browserAction.enable();
		totalEntries = currentBlockList.length + currentTitleList.length;
		if (paused != "") {
			chrome.browserAction.setBadgeText({text: "pause"});
			chrome.browserAction.setBadgeBackgroundColor({color: "#4cae4c"});
			currentBlockList = [];
			currentTitleList = [];
			totalEntries = 0;
		} else if (totalEntries > 0) {
			chrome.browserAction.setBadgeText({ text: totalEntries.toString() });
			chrome.browserAction.setBadgeBackgroundColor({color: "#d9534f"});
		} else {
			chrome.browserAction.setBadgeText({ text: "0" });
			chrome.browserAction.setBadgeBackgroundColor({color: "#4cae4c"});
		}
	}
	
	if (diffBlockList.length > 0 || diffExceptList.length > 0 || diffTitleList.length > 0) {
		diffBlockList = [];
		diffExceptList = [];
		diffTitleList = [];
		checkOpenTabs();
	}
	
	if (firstMessage) {
		firstMessage = false;
		
		if (version == 4) {
			statsTimer = window.setInterval(statsCheck, 2000);
		} else {
			statsTimer = window.setInterval(statsCheckv3, 1000);
		}
		
		allowIncognito();
		if (forceAllowFile) {
			allowFile();
		}
	}

});
chrome.runtime.setUninstallURL('https://getcoldturkey.com/support/extensions/chrome/?reason=uninstall');
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.command) {
		case "checkBlockUrl": 
			sendResponse({ version: version, block: checkBlockUrl(request.site, true), isPro: isPro, blockEmbedded: blockEmbedded, blockCharity: blockCharity });
			break;
		case "checkBlockTitle": 
			sendResponse({ version: version, block: checkBlockTitle(request.title, request.site, true), isPro: isPro, blockEmbedded: blockEmbedded, blockCharity: blockCharity });
			break;
		case "blockFrame":
			sendResponse({ result: true });
			blockFrame(request.params, sender.tab.id, sender.frameId);
			break;
		case "listBlocks":
			sendResponse({ addableBlocks: addableBlocks, itemCount: totalEntries, paused: paused });
			break;
		case "getURLs":
			sendResponse({ result: true });
			getURLs();
			break;
		case "open-blocker":
			sendResponse({ result: true });
			openBlocker();
			break;
		case "add-block":
			sendResponse({ result: true });
			addBlock(request.block, request.url);
			break;
		case "pause":
			sendResponse({ result: true });
			pause(request.key);
			break;
	}
});
chrome.tabs.onActivated.addListener(function() {
	checkOpenTabs();
});
chrome.idle.setDetectionInterval(300);
chrome.idle.onStateChanged.addListener(function stateChanged(state) {
	if (state === "active") {
		statsActive = true;
	} else {
		statsActive = false;
	}
});


/* Cold Turkey Blocker Methods */

function blockFrame(params, tabId, frameId) {
	var req = new XMLHttpRequest();
	if (version == 4) {
		req.open('GET', 'https://getcoldturkey.com/blocked/4.0/' + params, true); 
	} else {
		req.open('GET', 'https://getcoldturkey.com/blocked/3.0/' + params, true); 
	}
	req.onload = function () {
		if (req.status == 200) {
			chrome.tabs.sendMessage(tabId, {command: "blockFrame", blockPage: req.responseText}, {frameId: frameId} );
		}
	};
	req.send(null);
}

function allowIncognito() {
	chrome.extension.isAllowedIncognitoAccess(function(isAllowedAccess) {
		if (!isAllowedAccess && !ignoreIncognito) {
			var detailsURL = "chrome://extensions/?id=" + chrome.i18n.getMessage("@@extension_id");
			window.setTimeout(incognitoRequired, 10000);
			chrome.tabs.create({ url: detailsURL });
			alert('Please turn on "Allow in incognito" for the Cold Turkey extension.\n\nOtherwise, Chrome will be closed during locked blocks.');
		}
	});
}

function allowFile() {
	chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess) {
		if (!isAllowedAccess) {
			var detailsURL = "chrome://extensions/?id=" + chrome.i18n.getMessage("@@extension_id");
			window.setTimeout(fileRequired, 10000);
			chrome.tabs.create({ url: detailsURL });
			alert('Please turn on "Allow access to file URLs" for the Cold Turkey extension.\n\nOtherwise, Chrome will be closed during locked blocks.');
		}
	});
}

var incognitoRequired = function() {
	chrome.extension.isAllowedIncognitoAccess(function(isAllowedAccess) {
		if (!isAllowedAccess && !ignoreIncognito) {
			var detailsURL = "chrome://extensions/?id=" + chrome.i18n.getMessage("@@extension_id");
			chrome.tabs.create({ url: detailsURL });
			alert('Please turn on "Allow in incognito" for the Cold Turkey extension. Then, re-enable the extension.\n\nOtherwise, Chrome will be closed during locked blocks.');
			chrome.management.setEnabled(chrome.i18n.getMessage("@@extension_id"), false);
		}
	});
};

var fileRequired = function() {
	chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess) {
		if (!isAllowedAccess) {
			var detailsURL = "chrome://extensions/?id=" + chrome.i18n.getMessage("@@extension_id");
			chrome.tabs.create({ url: detailsURL });
			alert('Please turn on "Allow access to file URLs" for the Cold Turkey extension. Then, re-enable the extension.\n\nOtherwise, Chrome will be closed during locked blocks.');
			chrome.management.setEnabled(chrome.i18n.getMessage("@@extension_id"), false);
		}
	});
};

function checkOpenTabs() {
	var options;
	if (blockInactive) {
		options = {};
	} else {
		options = {active: true};
	}
	chrome.tabs.query(options, function(allActiveTabs) {
		for (var i = 0; i < allActiveTabs.length; i++) {
			if (allActiveTabs[i].title != "Blocked by Cold Turkey") {
				if (checkBlockUrl(allActiveTabs[i].url, false)) {
					chrome.tabs.reload(allActiveTabs[i].id);
				}
				if (checkBlockTitle(allActiveTabs[i].title, allActiveTabs[i].url, false)) {
					chrome.tabs.reload(allActiveTabs[i].id);
				}
			}
		}
	});
}

function openBlocker() {
	port.postMessage('open-blocker');
}

function pause(key) {
	if (typeof key != 'undefined' && key.length == 10 && /^\d{10}$/.test(key)) {
		var req = new XMLHttpRequest();  
		req.open('GET', 'https://getcoldturkey.com/activate/activate-break.php?v=break&key='+key+'&rand=' + Math.round(Math.random() * 10000000).toString(), true); 
		req.onload = function () {
			if (req.status == 200) {
				if (req.responseText.startsWith('true')) {
					port.postMessage('pause@' + key.replace(/@/g,'\\@'));
				} else {
					sendPauseError("Sorry, this break key has already been used or isn't valid.");
				}
			} else {
				sendPauseError("Something went wrong validating your break key. Please try again.");
			}
		};
		req.send(null);
	} else {
		sendPauseError("Sorry, this isn't a valid break key.");
	}
}

function sendPauseError(errorMessage) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {command: "cold-turkey-blocker-pause-error", errorMessage: errorMessage});  
	});
}

function addBlock(blockId, url) {
	var formattedUrl = decodeURIComponent(url).replace(/@/g,'\\@');
	if (formattedUrl.startsWith("file://")) {
		formattedUrl = formattedUrl.substring(0, formattedUrl.lastIndexOf("#"))
	} else {
		formattedUrl = formattedUrl.replace(/\/$/, "");
	}
	port.postMessage('add-block@' + blockId.replace(/@/g,'\\@') + '@' + formattedUrl);
}

function getURLs() {
	chrome.tabs.query({active: true, currentWindow: true}, function(allActiveTabs) {
		var allURLs = [];
		for (var i = 0; i < allActiveTabs.length; i++) {
			
			try {
				var temp = allActiveTabs[i].url.match(/^((http|https|ftp):\/\/)?(www\.)?(.+)\/?/);
				var url = temp[temp.length-1].replace(/\/$/, "").toLowerCase();
				if (url.includes("/") && !url.includes("//")) {
					var domains = url.split("/")[0];
					var domainsList = domains.split(".");
					allURLs.push(domains);
					if (domainsList.length > 2) {
						allURLs.push(domainsList[domainsList.length-2] + '.' + domainsList[domainsList.length-1]);
					}
				}
				allURLs.push(url);
			} catch (e) { }
			
		}
		chrome.runtime.sendMessage({ command: "urls", urls: allURLs }, function(response) { });
	});
}

function checkBlockUrl(site, countAsBlocked) {
	
	var input = decodeURI(site);
	var domain = '';
	var domains = '';
	var initUrl = '';
	
	if (input.startsWith("https://coldturkey.dpdcart.com")) {
		return false;
	} else if (input.startsWith("chrome") || input.startsWith("edge") || input.startsWith("opera") || input.startsWith("brave") || input.startsWith("vivaldi")) {
		return false;
	} else if (input.startsWith("file://")) {
		initUrl = input.substring(0, input.lastIndexOf("#")).toLowerCase();
	} else {
		try {
			var arrInitUrl = input.match(/^((http|https|ftp):\/\/)?(www\.)?(.+)\/?/);
			initUrl = arrInitUrl[arrInitUrl.length-1].replace(/\/$/, "").toLowerCase();
			domains = initUrl.split("/")[0];
			var domainsList = domains.split(".");
			if (domainsList.length > 2) {
				domain = domainsList[domainsList.length-2] + '.' + domainsList[domainsList.length-1];
			} else {
				domain = domains;
			}
		} catch (e) {
			initUrl = input;
		}
	}
	
	for (var i = 0; i < currentBlockList.length; i++) {
		var regexBlock = new RegExp("^" + escapeRegExp(currentBlockList[i].replace(/\/$/, "").toLowerCase()));
		if (domain.match(regexBlock) || domains.match(regexBlock) || initUrl.match(regexBlock)) {
			for (var j = 0; j < currentExceptionList.length; j++) {
				var regexAllow = new RegExp("^" + escapeRegExp(currentExceptionList[j].replace(/\/$/, "").toLowerCase()));
				if (domain.match(regexAllow) || domains.match(regexAllow) || initUrl.match(regexAllow)) {
					return false;
				}
			}
			if (countAsBlocked) {
				if (version == 1) {
					counter++;
				} else {
					if (statsEnabled) {
						port.postMessage('blocked@' + initUrl);
					}
				}
			}
			return true;
    	}
	}
	
	return false;
	
}

function checkBlockTitle(title, site, countAsBlocked) {
	
	for (var i = 0; i < currentTitleList.length; i++) {
		var regexBlock = new RegExp(("^" + escapeRegExp(currentTitleList[i]) + "$").toLowerCase());
		if (regexBlock.test(title.toLowerCase())) {
			if (countAsBlocked) {
				if (version == 1) {
					counter++;
				} else {
					if (statsEnabled) {
						if (site.startsWith('file://')) {
							port.postMessage('blocked@' + decodeURIComponent(site).replace(/\#$/, "").replace(/@/g,'\\@'));
						} else if (site.startsWith('ftp://') || site.startsWith('http://') || site.startsWith('https://')) {
							var domainInit = decodeURIComponent(site).match(/^((ftp|http|https):\/\/)?(www\.)?(.+)\/?/);
							if (domainInit != null && typeof domainInit[domainInit.length-1] != 'undefined') {
								port.postMessage('blocked@' + domainInit[domainInit.length-1].replace(/\/$/, "").replace(/@/g,'\\@'));
							}
						}
					}
				}
			}
			return true;
    	}
	}
	
	return false;
	
}

function statsCheckv3() {
	if (statsEnabled) {
		chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabs){
			if (typeof tabs[0] != 'undefined' && typeof tabs[0].url != 'undefined' && !tabs[0].url.startsWith("chrome") && !tabs[0].url.startsWith("edge") && !tabs[0].url.startsWith("opera") && !tabs[0].url.startsWith("brave") && !tabs[0].url.startsWith("vivaldi") && !tabs[0].url.startsWith("file://") && tabs[0].title != "Blocked by Cold Turkey") {	
				try {
					chrome.windows.get(tabs[0].windowId, function(activeWindow){
						if (activeWindow.focused && (!activeWindow.incognito || activeWindow.incognito && statsEnabledIncognito) && (statsActive || activeWindow.state === 'fullscreen')) {
							var domainInit = tabs[0].url.match(/^((ftp|http|https):\/\/)?(www\.)?(.+)\/?/);
							var domains = domainInit[domainInit.length-1].replace(/\/$/, "").split("/")[0];
							port.postMessage('stats@' + domains);
						}
					});
				} catch (e) {
				}
			}
		});		
	}
}

function statsCheck() {
	if (statsEnabled) {
		try {
			chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabs){
				for (var i = 0; i < tabs.length; i++) {
					if (typeof tabs[i] != 'undefined' && typeof tabs[i].url != 'undefined' && typeof tabs[i].title == 'string' && tabs[i].title != "Blocked by Cold Turkey") {	
						if ((statsActive || statsStrict) && (!tabs[i].incognito || (tabs[i].incognito && statsEnabledIncognito))) {
							
							port.postMessage('titleStats@' + tabs[i].title.replace(/@/g,'\\@'));
							
							if (tabs[i].url.startsWith('file://')) {
								var formattedUrl = decodeURIComponent(tabs[i].url).replace(/@/g,'\\@');
								formattedUrl = formattedUrl.substring(0, formattedUrl.lastIndexOf("#"));
								port.postMessage('stats@' + formattedUrl);
							} else if (tabs[i].url.startsWith('ftp://') || tabs[i].url.startsWith('http://') || tabs[i].url.startsWith('https://')) {
								var domainInit = decodeURIComponent(tabs[i].url).match(/^((ftp|http|https):\/\/)?(www\.)?(.+)\/?/);
								if (domainInit != null && typeof domainInit[domainInit.length-1] != 'undefined') {
									port.postMessage('stats@' + domainInit[domainInit.length-1].replace(/\/$/, "").replace(/@/g,'\\@'));
								}
							}
							
						}
					}
				}
			});
			if (statsStrict) {
				chrome.tabs.query({active: false}, function(tabs){
					for (var i = 0; i < tabs.length; i++) {
						if (typeof tabs[i] != 'undefined' && typeof tabs[i].url != 'undefined' && typeof tabs[i].title == 'string' && tabs[i].title != "Blocked by Cold Turkey") {	
							if (!tabs[i].incognito || (tabs[i].incognito && statsEnabledIncognito)) {
								
								port.postMessage('titleStrictStats@' + tabs[i].title.replace(/@/g,'\\@'));
								
								if (tabs[i].url.startsWith('file://')) {
									var formattedUrl = decodeURIComponent(tabs[i].url).replace(/@/g,'\\@');
									formattedUrl = formattedUrl.substring(0, formattedUrl.lastIndexOf("#"));
									port.postMessage('statsStrict@' + formattedUrl);
								} else if (tabs[i].url.startsWith('ftp://') || tabs[i].url.startsWith('http://') || tabs[i].url.startsWith('https://')) {
									var domainInit = decodeURIComponent(tabs[i].url).match(/^((ftp|http|https):\/\/)?(www\.)?(.+)\/?/);
									if (domainInit != null && typeof domainInit[domainInit.length-1] != 'undefined') {
										port.postMessage('strictStats@' + domainInit[domainInit.length-1].replace(/\/$/, "").replace(/@/g,'\\@'));
									}
								}
								
							}
						}
					}
				});
			}
		} catch (e) {}
	}
}

function doubleCheck() {
	checkOpenTabs();
}

/* Tools */

function escapeRegExp(str) {
	var initStr = str.replace(/[\-\[\]\/\{\}\(\)\+\?\^\$\|]/g, "\\$&");
	var regexStr = initStr.replace(/\.\*/g, "*").split(".");
	var fixed = regexStr.join("\\.").replace(/\*/g, ".*");
	return fixed;
}

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};
