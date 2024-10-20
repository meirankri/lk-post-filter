import axios from "axios"
import type { PlasmoCSConfig } from "plasmo"
 
export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/feed*"],
  all_frames: true
}

function sendMessageWithRetry(message: any, maxRetries = 3, delay = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const sendAttempt = (attemptNumber: number) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error("Extension context invalidated"))
        return
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`Attempt ${attemptNumber}: ${chrome.runtime.lastError.message}`)
          if (attemptNumber < maxRetries) {
            setTimeout(() => sendAttempt(attemptNumber + 1), delay)
          } else {
            reject(new Error(`Maximum number of attempts reached: ${chrome.runtime.lastError.message}`))
          }
        } else {
          resolve(response)
        }
      })
    }
    sendAttempt(1)
  })
}

function removeEmojis(text) {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

async function removeStopwords(text) {
  try {
      const response = await axios.get('https://stopwordapi.com/api/v1/stopwords', {
          params: {
              langs: 'fr',
              format: 'json'
          }
      });
      const stopwords = response.data;
      const words = text.toLowerCase().split(/\s+/);
      return words.filter(word => !stopwords.includes(word)).join(' ');
  } catch (error) {
      console.error("Error while retrieving stopwords:", error);
      return text; // In case of error, return the original text
  }
}

async function classifyPost(postElement: Element, postContent: string) {
  if (postElement.hasAttribute('data-classified')) {
    console.log("Post already classified, ignored.")
    return
  }

  const authorLink = postElement.querySelector('.update-components-actor__meta a')
  if (authorLink && authorLink.textContent.toLowerCase().includes('meir ankri')) {
    return
  }

  const postDescription = getPostDescription(postElement)
  if (postDescription === "") {
    return
  }
  const firstTwoWords = getFirstTwoWords(postDescription)
  const cleanedContent = await prepareContent(postDescription)

  try {
    const response = await sendMessageWithRetry({ type: "CLASSIFY_POST", content: cleanedContent })
    console.log("Post classified:", response.classification)

    markPostAsClassified(postElement)
    addClassificationDetails(postElement, firstTwoWords, response)
    applyPostStyle(postElement, response.isNegative)
  } catch (error) {
    handleClassificationError(error, postElement, postContent)
  }
}

function getPostDescription(postElement: Element): string {
  return (postElement.querySelector('.feed-shared-update-v2__description-wrapper') as HTMLElement)?.innerText || ""
}

function getFirstTwoWords(text: string): string {
  return text.split(/\s+/).slice(0, 2).join(' ')
}

async function prepareContent(text: string): Promise<string> {
  const cleanedContent = removeEmojis(text)
  const contentWithoutStopwords = await removeStopwords(cleanedContent)
  return contentWithoutStopwords.slice(0, 200)
}

function markPostAsClassified(postElement: Element): void {
  postElement.setAttribute('data-classified', 'true')
}

function addClassificationDetails(postElement: Element, firstTwoWords: string, response: any): void {
  const detailsButton = createDetailsButton()
  const detailsContainer = createDetailsContainer(firstTwoWords, response)
  
  postElement.insertAdjacentElement('afterbegin', detailsButton)
  postElement.insertAdjacentElement('afterbegin', detailsContainer)

  detailsButton.addEventListener('click', () => toggleDetailsVisibility(detailsContainer))
}

function createDetailsButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'classification-details-button'
  button.textContent = 'LK-AI'
  return button
}

function createDetailsContainer(firstTwoWords: string, response: any): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'classification-details'
  container.style.display = 'none'

  const statusElement = createStatusElement(firstTwoWords)
  const tagsElement = createTagsElement(response.classification)

  container.appendChild(statusElement)
  container.appendChild(tagsElement)

  return container
}

function createStatusElement(firstTwoWords: string): HTMLDivElement {
  const statusElement = document.createElement('div')
  statusElement.className = 'post-status'
  statusElement.textContent = `Post processed - "${firstTwoWords}..."`
  return statusElement
}

function createTagsElement(classification: any[]): HTMLDivElement {
  const tagsElement = document.createElement('div')
  tagsElement.className = 'post-tags'
  classification.forEach(item => {
    const tagElement = document.createElement('span')
    tagElement.className = 'post-tag'
    tagElement.textContent = `${item.label}: ${(item.score * 100).toFixed(2)}%`
    tagsElement.appendChild(tagElement)
  })
  return tagsElement
}

function toggleDetailsVisibility(detailsContainer: HTMLElement): void {
  detailsContainer.style.display = detailsContainer.style.display === 'none' ? 'block' : 'none'
}

function applyPostStyle(postElement: Element, isNegative: boolean): void {
  const targetElement = postElement.querySelector('.fie-impression-container')
  if (targetElement) {
    if (isNegative) {
      console.log("Post classified as negative, adding CSS class.")
      targetElement.classList.add("negative-post")
      addRemoveNegativeButton(postElement.querySelector('.classification-details'))
    } else {
      targetElement.classList.add("positive-post")
    }
  } else {
    console.warn("Target element not found in post")
  }
}

function handleClassificationError(error: Error, postElement: Element, postContent: string): void {
  console.error("Failed to classify post:", error)
  if (error.message === "Extension context invalidated") {
    console.log("Extension has been reloaded. Retrying after a short delay.")
    setTimeout(() => classifyPost(postElement, postContent), 2000)
  }
}

function addRemoveNegativeButton(container: Element) {
  const removeButton = document.createElement('button')
  removeButton.textContent = 'Remove negative'
  removeButton.className = 'remove-negative-button'
  removeButton.addEventListener('click', () => {
    const postElement = container.closest('.feed-shared-update-v2')
    const targetElement = postElement.querySelector('.fie-impression-container')
    if (targetElement) {
      targetElement.classList.remove('negative-post')
    }
    removeButton.remove()
  })
  container.appendChild(removeButton)
}

function observePosts() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.classList.contains('feed-shared-update-v2') && !node.hasAttribute('data-classified')) {
            const postContent = node.textContent || ""
            classifyPost(node, postContent)
          }
        })
      }
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })

  processExistingPosts()
}

function processExistingPosts() {
  const existingPosts = document.querySelectorAll('.feed-shared-update-v2:not([data-classified])')
  existingPosts.forEach((post) => {
    if (post instanceof HTMLElement) {
      const postContent = post.textContent || ""
      classifyPost(post, postContent)
    }
  })
}

function injectCSS() {
  const style = document.createElement('style')
  style.textContent = `
    .fie-impression-container.negative-post {
      background-color: rgba(255, 0, 0, 0.1);
      border: 1px solid red;
      font-size: 12px;
    }

    .fie-impression-container.negative-post *{
      color: red;
      font-size: inherit !important;
    }

    .classification-details-button {
      position: absolute;
      top: 5px;
      right: 5px;
      background-color: #0077b5;
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      font-size: 12px;
      cursor: pointer;
      z-index: 2;
    }

    .classification-details {
      position: absolute;
      top: 40px;
      right: 5px;
      background-color: white;
      border: 1px solid #0077b5;
      padding: 10px;
      border-radius: 5px;
      z-index: 2;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    .post-status {
      margin-bottom: 5px;
      font-weight: bold;
    }

    .post-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .post-tag {
      background-color: #f3f6f8;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 12px;
    }

    .remove-negative-button {
      margin-top: 5px;
      background-color: #fff;
      border: 1px solid #0077b5;
      color: #0077b5;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 12px;
    }
  `
  document.head.appendChild(style)
}

let loaderElement: HTMLDivElement | null = null;
let modelLoaded = false;

function createLoader() {
    if (!loaderElement && !modelLoaded) {
        loaderElement = document.createElement('div');
        loaderElement.id = 'ai-extension-loader';
        loaderElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 9999;
        `;
        loaderElement.textContent = "Loading model...";
        document.body.appendChild(loaderElement);
    }
}

function updateLoader(progress: number) {
    if (loaderElement && !modelLoaded) {
        loaderElement.textContent = `Loading model: ${Math.round(progress)}%`;
        if (progress === 100) {
            modelLoaded = true;
            setTimeout(removeLoader, 1000);
        }
    }
}

function removeLoader() {
    if (loaderElement && loaderElement.parentNode) {
        loaderElement.parentNode.removeChild(loaderElement);
        loaderElement = null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_LOADER") {
        if (!modelLoaded) {
            updateLoader(message.data.progress);
        }
        if (message.modelLoaded) {
            modelLoaded = true;
            removeLoader();
        }
    }
});

// Show loader as soon as the page loads
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createLoader);
} else {
    createLoader();
}

// Function to initialize the extension
function initializeExtension() {
    createLoader();
    injectCSS();
    observePosts();
}

// Initialize the extension as soon as possible
if (document.readyState === "loading" || document.readyState === "complete") {
    document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
    initializeExtension();
}
