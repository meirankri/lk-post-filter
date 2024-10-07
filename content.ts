import type { PlasmoContentScript } from "plasmo"
import { ClassificationDisplay } from "./components/ClassificationDisplay"

export const config: PlasmoContentScript = {
  matches: ["https://www.linkedin.com/feed/*"]
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
          console.warn(`Tentative ${attemptNumber}: ${chrome.runtime.lastError.message}`)
          if (attemptNumber < maxRetries) {
            setTimeout(() => sendAttempt(attemptNumber + 1), delay)
          } else {
            reject(new Error(`Nombre maximal de tentatives atteint: ${chrome.runtime.lastError.message}`))
          }
        } else {
          resolve(response)
        }
      })
    }
    sendAttempt(1)
  })
}

async function classifyPost(postElement: Element, postContent: string) {
  try {
    const response = await sendMessageWithRetry({ type: "CLASSIFY_POST", content: postContent })
    console.log("Post classifié:", response)

    if (response && response.classification) {
      if (response.classification.label === "NEGATIVE") {
        console.log("Post classé comme négatif, ajout d'une classe CSS.")

        try {
        
        const targetElement = postElement.querySelector('#fie-impression-container')
        if (targetElement) {
            targetElement.classList.add("negative-post")
          } else {
              console.warn("Élément cible non trouvé dans le post")
            }
        } catch (error) {
            console.error("error with selecting", error);
        }
      } 
    }
  } catch (error) {
    console.error("Échec de la classification du post:", error)
    if (error.message === "Extension context invalidated") {
      console.log("L'extension a été rechargée. Réessayez après un court délai.")
      setTimeout(() => classifyPost(postElement, postContent), 2000)
    }
  }
}

function observePosts() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.classList.contains('feed-shared-update-v2')) {
            const postContent = node.textContent || ""
            classifyPost(node, postContent)
          }
        })
      }
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

function injectCSS() {
  const style = document.createElement('style')
  style.textContent = `
    #fie-impression-container.negative-post {
      background-color: rgba(255, 0, 0, 0.1);
      border: 1px solid red;
    }
  `
  document.head.appendChild(style)
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  injectCSS()
  observePosts()
} else {
  document.addEventListener("DOMContentLoaded", () => {
    injectCSS()
    observePosts()
  })
}