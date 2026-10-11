// Inter Wallet Chrome Extension Background Service Worker

// Setup default side panel behavior
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  }
})

// Allow opening the side panel programmatically from the popup UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'OPEN_SIDEPANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0]
      if (currentTab?.windowId && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ windowId: currentTab.windowId })
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err?.message }))
      } else {
        sendResponse({ success: false, error: 'No active window found' })
      }
    })
    return true
  }
})
