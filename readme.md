# 🪆 matryoshka

a hierarchical task manager that helps you break complex tasks down into manageable subtasks.

<i>now available on <a href="https://hunterirving.github.io/matryoshka/">GitHub Pages</a>!</i>

### key features
- unlimited subtask depth
- intuitive keyboard controls for rapid navigation
- automatic saving using browser's local storage
- works completely offline

### quickstart
1. start by adding subtasks to the root "todo" task
2. use `Shift + Arrow Right` to navigate into a subtask, making it the new parent task
3. break subtasks down further as desired
4. use `Shift + Arrow Left` to return to parent tasks
5. quickly mark tasks as complete or incomplete using `Shift + Enter`
6. reorganize tasks using `Shift + Arrow Up/Down`


## controls

### navigation
- `Arrow Up/Down` move between tasks at the same level
- `Shift + Arrow Right` navigate into a subtask
- `Shift + Arrow Left` navigate back to the parent task

### task management
- `Enter` add a new task below the current selection
- `Arrow Down` (on last subtask) add a new task at the bottom of the list
- `Backspace` (on empty task): delete the current task (including any subtasks)
- `Shift + Enter` toggle task completion status (status changes cascade to subtasks)
- `Shift + Arrow Up/Down` reposition the selected task within its current level

### text editing
- standard text editing controls apply when a task's text area is focused
- `Command/Ctrl + C`  copy the entire text of the currently selected task
- `Command/Ctrl + V` paste text content from the clipboard into the current task's text input

## data persistence
your task tree is automatically saved to your browser's local storage. this ensures your tasks will persist even if you close the browser or refresh the page. note that clearing your browser data may erase your saved tasks.

## browser compatibility
this application is designed to run on modern web browsers with javascript enabled.

## privacy
all data is stored locally on your machine. no data is sent to or stored on any external servers.

## license
this project is licensed under the GNU general public license v3.0.