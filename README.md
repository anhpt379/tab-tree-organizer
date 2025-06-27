# 🌳 Tab Tree Organizer

A Chrome extension that automatically organizes tabs into groups based on their
parent-child relationships. The extension tracks how tabs are opened from other
tabs and automatically creates and manages tab groups to maintain a visual
representation of this hierarchy.

## Features

- **Automatic Tab Grouping**: When you open a new tab from an existing tab, they are automatically grouped together
- **Numerical Group Names**: Tab groups are named with sequential numbers (1, 2, 3, etc.)
- **Number Reuse**: When a tab group is closed, its number becomes available for reuse
- **Intelligent Ungrouping**: When a tab group contains only one tab, it's automatically ungrouped
- **New Tab Behavior**: Empty new tabs (opened with Cmd+T/Ctrl+T) are not grouped
- **Pinned Tab Protection**: Opening tabs from pinned tabs doesn't create groups

## Installation

### From Source (Developer Mode)

1. Clone this repository or download the ZIP file
2. Extract the files to a directory on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" using the toggle in the top-right corner
5. Click "Load unpacked" and select the directory containing the extension files
6. The extension is now installed and running

### From Chrome Web Store (Once Published)

1. Visit the Chrome Web Store page for Tab Tree Organizer
2. Click "Add to Chrome"
3. Confirm the installation

## How to Use

1. **No Configuration Needed**: Once installed, the extension works automatically
2. **Browsing as Usual**: As you browse the web and open links in new tabs, the extension will automatically organize related tabs into groups
3. **Tab Groups**: Tabs are grouped based on which tab they were opened from
4. **Group Management**: The extension handles all group creation, naming, and cleanup automatically

## How It Works

The extension tracks the parent-child relationship between tabs:

1. When you open a link in a new tab, the extension identifies the source tab as the "parent"
2. If the parent tab isn't already in a group, a new group is created with both tabs
3. If the parent tab is already in a group, the new tab joins that group
4. Groups are automatically named with sequential numbers
5. When tabs are closed, the extension checks if groups should be maintained or dissolved
6. Numbers from closed groups are reused for new groups

## Edge Cases Handled

- **Pinned Tabs**: Tabs opened from pinned tabs don't create groups
- **New Empty Tabs**: When you open a new empty tab (Cmd+T/Ctrl+T), it's not grouped
- **New Tab in Group**: If you open a new empty tab while in a tab group, it's automatically removed from the group
- **Single Tab Groups**: Groups with only one tab are automatically ungrouped
- **Group Deletion**: When groups are manually removed, their numbers become available for reuse

## Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests.

## License

This project is available under the MIT License.
