// Store tab relationships (parent-child)
const tabRelationships = new Map();
// Store which tabs are currently in groups
const tabToGroup = new Map();

// Helper function to update group title based on collapsed state
async function updateGroupTitle(groupId) {
  try {
    const group = await chrome.tabGroups.get(groupId);
    const title = group.collapsed ? "↑" : "↓";
    await chrome.tabGroups.update(groupId, { title });
  } catch (error) {
    console.error("Error updating group title:", error);
  }
}

// Helper function to check and ungroup single-tab groups
async function checkAndUngroupSingleTabGroups(groupId) {
  try {
    // Query tabs in this group
    const tabs = await chrome.tabs.query({ groupId });

    // If only one tab remains in the group, ungroup it
    if (tabs.length === 1) {
      console.log(
        `Ungrouping tab ${tabs[0].id} from group ${groupId} (last tab)`,
      );

      try {
        await chrome.tabs.ungroup(tabs[0].id);
        tabToGroup.delete(tabs[0].id);
      } catch (ungroupError) {
        console.error("Error ungrouping tab:", ungroupError);
      }
    }
  } catch (error) {
    console.error("Error checking group tabs:", error);
  }
}

// Listen for tab creation events
chrome.tabs.onCreated.addListener(async (tab) => {
  // Skip if it's a new empty tab (chrome://newtab/)
  if (tab.pendingUrl === "chrome://newtab/" || tab.url === "chrome://newtab/") {
    return;
  }

  // Wait a bit to get the opener tab (ensures openerTabId is populated)
  setTimeout(async () => {
    try {
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

          // Set initial title based on state (new groups are expanded by default)
          await updateGroupTitle(groupId);

          tabToGroup.set(currentTab.openerTabId, groupId);
          tabToGroup.set(tab.id, groupId);
        }
      }
    } catch (error) {
      console.error("Error handling new tab:", error);
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

    // Add a small delay to allow Chrome to update its internal state
    setTimeout(() => {
      checkAndUngroupSingleTabGroups(groupId);
    }, 50);
  }
});

// Listen for tab group removal
chrome.tabGroups.onRemoved.addListener((group) => {
  // Clean up any tabs that were in this group
  for (const [tabId, groupId] of tabToGroup.entries()) {
    if (groupId === group.id) {
      tabToGroup.delete(tabId);
    }
  }
});

// Listen for tab group updates (collapsed/expanded state changes)
chrome.tabGroups.onUpdated.addListener(async (group) => {
  // Update title when collapsed state changes
  await updateGroupTitle(group.id);
});

// Handle tab updates (for when a new tab page gets navigated)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // If this is a newtab that's being navigated away
  if (changeInfo.url && tab.url !== "chrome://newtab/") {
    // If this tab is in a group, check if it's the only one
    if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      setTimeout(() => {
        checkAndUngroupSingleTabGroups(tab.groupId);
      }, 50);
    }
  }
});

// If a new tab is created in a group (by using Cmd+T within a grouped tab),
// move it out of the group
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url === "chrome://newtab/" || tab.pendingUrl === "chrome://newtab/") {
    // Wait a bit to ensure the tab has been properly created and possibly grouped
    setTimeout(async () => {
      try {
        const currentTab = await chrome.tabs.get(tab.id);
        if (
          currentTab &&
          currentTab.groupId &&
          currentTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
        ) {
          await chrome.tabs.ungroup(tab.id);
        }
      } catch (error) {
        console.error("Error handling empty tab:", error);
      }
    }, 100);
  }
});

// Add a periodic check for orphaned single-tab groups
setInterval(async () => {
  // Get all tab groups
  try {
    const groups = await chrome.tabGroups.query({});
    for (const group of groups) {
      checkAndUngroupSingleTabGroups(group.id);
    }
  } catch (error) {
    console.error("Error in periodic group check:", error);
  }
}, 5000); // Check every 5 seconds

// Initialize the extension by checking all existing tabs
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Tab Tree Organizer installed");

  try {
    // Update all existing tab groups with appropriate titles
    const groups = await chrome.tabGroups.query({});
    for (const group of groups) {
      await updateGroupTitle(group.id);
    }

    // Get all tabs and map them to their groups
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        tabToGroup.set(tab.id, tab.groupId);
      }
    }
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
});
