# 🪆 matryoshka

a nested task manager that breaks complex tasks into manageable subtasks.

<a href="https://hunterirving.github.io/matryoshka/"><img src="screenshot.gif" width="560px"></a><br>

<b><i>try it now <a href="https://hunterirving.github.io/matryoshka/">in your browser</a> !</i></b>
<br>(physical keyboard required for now)

### key features
- unlimited subtask depth
- intuitive keyboard controls for rapid navigation
- automatic saving using browser's local storage
- works completely offline

### quickstart
1. press the `Enter` key to add subtasks to the root "todo" task
2. give each new subtask a meaningful name
3. use `Shift + Arrow Right` to navigate into a subtask
4. use `Shift + Arrow Left` to return to the parent task
5. use `Shift + Enter` to quickly mark tasks as complete or incomplete

## controls

### navigation
- `Arrow Up/Down` move between tasks at the same level
- `Shift + Arrow Right` navigate into a subtask
- `Shift + Arrow Left` return to the enclosing parent task

### task management
- `Enter` add a new task
- `Arrow Down` (on last subtask) add a new task at the bottom of the list
- `Backspace` (when selected task's text is empty) remove the task and its subtasks
- `Shift + Enter` toggle selected task's completion status
- `Shift + Arrow Up/Down` reposition the selected task within its current level

### text editing
- `Left/Right` move text cursor within selected task
- `Command/Ctrl + C` copy the selected task's text (or highlighted substring)
- `Command/Ctrl + X` cut the selected task's text (or highlighted substring)
- `Command/Ctrl + V` paste text content from the clipboard
- `Command/Ctrl + Z` undo text edit
- `Command/Ctrl + Shift + Z` redo text edit

### importing/exporting
your task tree is automatically saved to your browser's [local storage](#data-persistence) after each edit. for manual backups or cross-device use:

- `Command/Ctrl + S` export task tree to .txt file
- `Command/Ctrl + O` import task tree from .txt file
## themes
press `F2` to cycle through available themes.

to create a new theme, add a CSS ruleset with the following structure to index.html:

```css
:root[data-theme="sunflower"] {
	--background: var(--pollen);
	--text: var(--loam);
	--highlight: var(--chlorophyll);
	--accent: var(--terracotta);
}
```

You can also use themes to set custom fonts, etc:

``` css
:root[data-theme="medieval"] {
	--background: var(--moss);
	--text: var(--goat-milk);
	--highlight: var(--burl);
	--accent: var(--flame);
	& input[type="text"] {
		font-family: MedievalSharp;
	}
}
```

You can store named colors in the `:root` selector at the top of the `<style>` tag:

```css
:root {
	--pollen: #f4a127;
	--loam: #5a352b;
	--chlorophyll: #5aa83b;
	--terracotta: #b15c2e;

	--wheat: #d2c3a3;
	--earth: #4a3c31;
	--pumpkin: #cb7c52;
	--tobacco: #7d6c55;

	--moss: #20302f;
	--goat-milk: #d8d3c9;
	--burl: #231f20;
	--flame: #c63728;

	.
	.
	.
}
```

## data persistences
your task tree is automatically saved to your browser's local storage after each edit. this ensures your tasks will persist even if you close the browser or refresh the page.

**⚠️ warning:** clearing your browsing data may erase your saved tasks. use the [export feature](#importingexporting) to create a backup before clearing your browsing data.

## browser compatibility
this application is designed to run on modern web browsers with javascript enabled. mobile browsers are supported, but a physical keyboard is required (for now).

## privacy
all data is stored locally on your machine. no data is sent to or stored on any external servers.

## licenses
this project is licensed under the <a href="https://github.com/hunterirving/matryoshka/blob/main/LICENSE">GNU General Public License v3.0</a>.

the MedievalSharp font by <a href="http://www.identifont.com/show?3DQU">Wojciech Kalinowski</a> is licensed under the <a href="https://github.com/hunterirving/matryoshka/blob/main/OFL.txt">SIL Open Font License, version 1.1</a>.