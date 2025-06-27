// Store tab relationships (parent-child)
const tabRelationships = new Map();
// Store tab group IDs and their associated numbers
const tabGroups = new Map();
// Store which tabs are currently in groups
const tabToGroup = new Map();
// Track used group numbers
const usedGroupNumbers = new Set();
// Maximum group number used so far
let maxGroupNumber = 0;

// Function to get the next available group number
function getNextGroupNumber() {
  // First try to find the smallest unused number
  for (let i = 1; i <= maxGroupNumber + 1; i++) {
    if (!usedGroupNumbers.has(i)) {
      usedGroupNumbers.add(i);
      maxGroupNumber = Math.max(maxGroupNumber, i);
      return i;
    }
  }
  // Fallback (shouldn't reach here)
  maxGroupNumber++;
  usedGroupNumbers.add(maxGroupNumber);
  return maxGroupNumber;
}

// Listen for tab creation events
chrome.tabs.onCreated.addListener(async (tab) => {
  // Skip if it's a new empty tab (chrome://newtab/)
  if (tab.pendingUrl === "chrome://newtab/" || tab.url === "chrome://newtab/") {
    return;
  }

  // Wait a bit to get the opener tab (ensures openerTabId is populated)
  setTimeout(async () => {
    const currentTab = await chrome.tabs.get(tab.id);

    // Skip if tab doesn't exist anymore
    if (!currentTab) return;

    // If this tab was opened from another tab
    if (currentTab.openerTabId) {
      const openerTab = await chrome.tabs.get(currentTab.openerTabId);

      // Skip if opener tab doesn't exist anymore
      if (!openerTab) return;

      // Skip if opener tab is pinned
      if (openerTab.pinned) return;

      // Store the relationship
      tabRelationships.set(tab.id, currentTab.openerTabId);

      // Check if opener tab is in a group
      if (
        openerTab.groupId &&
        openerTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
      ) {
        // Add this tab to the same group
        await chrome.tabs.group({
          tabIds: [tab.id],
          groupId: openerTab.groupId,
        });
        tabToGroup.set(tab.id, openerTab.groupId);
      } else {
        // Create a new group with opener and new tab
        const groupId = await chrome.tabs.group({
          tabIds: [currentTab.openerTabId, tab.id],
        });

        // Get the next available group number
        const groupNumber = getNextGroupNumber();

        // Update the group title to the number
        await chrome.tabGroups.update(groupId, {
          title: groupNumber.toString(),
        });

        // Store the group and update counter
        tabGroups.set(groupId, groupNumber);
        tabToGroup.set(currentTab.openerTabId, groupId);
        tabToGroup.set(tab.id, groupId);
      }
    }
  }, 300);
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Remove from relationships
  tabRelationships.delete(tabId);

  // Check if this tab was in a group
  const groupId = tabToGroup.get(tabId);
  if (groupId) {
    tabToGroup.delete(tabId);

    // Check if this was the last tab in the group
    try {
      const tabs = await chrome.tabs.query({ groupId });

      // If only one tab remains in the group, ungroup it
      if (tabs.length === 1) {
        await chrome.tabs.ungroup(tabs[0].id);
        tabToGroup.delete(tabs[0].id);

        // Release the group number for reuse
        const groupNumber = tabGroups.get(groupId);
        if (groupNumber) {
          usedGroupNumbers.delete(groupNumber);
        }

        tabGroups.delete(groupId);
      }
    } catch (error) {
      // Group might not exist anymore, just clean up
      const groupNumber = tabGroups.get(groupId);
      if (groupNumber) {
        usedGroupNumbers.delete(groupNumber);
      }

      tabGroups.delete(groupId);
    }
  }
});

// Listen for tab group removal
chrome.tabGroups.onRemoved.addListener((group) => {
  // When a group is removed, release its number for reuse
  const groupNumber = tabGroups.get(group.id);
  if (groupNumber) {
    usedGroupNumbers.delete(groupNumber);
  }

  // Remove it from our tracking
  tabGroups.delete(group.id);

  // Clean up any tabs that were in this group
  for (const [tabId, groupId] of tabToGroup.entries()) {
    if (groupId === group.id) {
      tabToGroup.delete(tabId);
    }
  }
});

// Handle tab updates (for when a new tab page gets navigated)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // If this is a newtab that's being navigated away
  if (changeInfo.url && tab.url !== "chrome://newtab/") {
    // If this tab is in a group but is the only one, ungroup it
    if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const tabs = await chrome.tabs.query({ groupId: tab.groupId });
      if (tabs.length === 1) {
        await chrome.tabs.ungroup(tabId);

        // Release the group number for reuse
        const groupNumber = tabGroups.get(tab.groupId);
        if (groupNumber) {
          usedGroupNumbers.delete(groupNumber);
        }

        tabToGroup.delete(tabId);
        tabGroups.delete(tab.groupId);
      }
    }
  }
});

// If a new tab is created in a group (by using Cmd+T within a grouped tab),
// move it out of the group
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url === "chrome://newtab/" || tab.pendingUrl === "chrome://newtab/") {
    // Wait a bit to ensure the tab has been properly created and possibly grouped
    setTimeout(async () => {
      const currentTab = await chrome.tabs.get(tab.id);
      if (
        currentTab &&
        currentTab.groupId &&
        currentTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
      ) {
        await chrome.tabs.ungroup(tab.id);
      }
    }, 100);
  }
});
