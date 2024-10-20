// background.js - Handles requests from the UI, runs the model, then sends back a response

import { pipeline, env, type PipelineType } from '@xenova/transformers';
import { Storage } from '@plasmohq/storage';

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;

env.backends.onnx.preferredBackend = 'cpu';



class PipelineSingleton {
    static task = 'zero-shot-classification';
    static model = 'Xenova/nli-deberta-v3-xsmall';
    static instance = null;

    static async getInstance(progressCallback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task as PipelineType, this.model, { progress_callback: progressCallback });
        }

        return this.instance;
    }
}
let modelLoaded = false;


// Create generic classify function, which will be reused for the different types of events.
const classify = async (text) => {
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let model = await PipelineSingleton.getInstance((data) => {
        console.log("data", data);
        if (data.status === "ready") {
            modelLoaded = true;
        }
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs.length > 0 && tabs[0].id !== undefined) {
                sendMessageWithRetry(tabs[0].id, {type: "SHOW_LOADER", data: data})
                    .then(response => console.log('Message sent successfully'))
                    .catch(error => console.error('Failed to send message:', error));
            } else {
                console.error("Aucun onglet actif trouvé ou ID d'onglet non défini");
            }
        });
    });

    const storage = new Storage();
    const storedLabels = await storage.get("labels");
    const labels = storedLabels ? JSON.parse(storedLabels) : [];

    if (labels.length === 0) {
        console.error("No labels found in storage");
        return [];
    }

    // Actually run the model on the input text
    const result = await model(text, labels, { multi_label: true });

    console.log('result', result.scores)
    const classificationResults = result.labels.map((label, index) => ({
        label,
        score: result.scores[index]
    }));
    console.log('classificationResults', classificationResults)
    return classificationResults
};

function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    function attemptSend(attemptNumber) {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          if (attemptNumber < maxRetries) {
            setTimeout(() => attemptSend(attemptNumber + 1), 1000);
          } else {
            reject(new Error('Max retries reached'));
          }
        } else {
          resolve(response);
        }
      });
    }
    attemptSend(1);
  });
}

////////////////////// 1. Context Menus //////////////////////
//
// Add a listener to create the initial context menu items,
// context menu items only need to be created at runtime.onInstalled
chrome.runtime.onInstalled.addListener(function () {
    // Register a context menu item that will only show up for selection text.
    chrome.contextMenus.create({
        id: 'classify-selection',
        title: 'Classify "%s"',
        contexts: ['selection'],
    });
});

// Perform inference when the user clicks a context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Ignore context menu clicks that are not for classifications (or when there is no input)
    if (info.menuItemId !== 'classify-selection' || !info.selectionText) return;

    // Perform classification on the selected text
    let result = await classify(info.selectionText);

    // Do something with the result
    chrome.scripting.executeScript({
        target: { tabId: tab.id },    // Run in the tab that the user clicked in
        args: [result],
        func: (result) => {
            console.log('result', result)
        },
    });
});
//////////////////////////////////////////////////////////////

////////////////////// 2. Message Events /////////////////////
// 
// Listen for messages from the UI, process it, and send the result back.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'CLASSIFY_POST') return;
    classify(message.content)
      .then((classification) => {
        const isNegative = !classification.some(item => item.score > 0.5);
        sendResponse({ classification: classification, isNegative: isNegative });
      })
      .catch((error) => {
        console.error('Erreur pendant la classification:', error);
        sendResponse({ error: error.message });
      });
    return true;
});
//////////////////////////////////////////////////////////////

