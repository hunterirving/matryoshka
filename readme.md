# 🪆 matryoshka

a nested task manager that breaks complex tasks into manageable subtasks.

<i>try it now <a href="https://hunterirving.github.io/matryoshka/">in your browser</a>!</i>
<br>(physical keyboard required (for now))

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
- `Shift + Enter` toggle task completion status (status changes cascade to subtasks)
- `Shift + Arrow Up/Down` reposition the selected task within its current level

### text editing
- standard text editing controls apply 
- `Command/Ctrl + C` copy the selected task's text
- `Command/Ctrl + V` paste text content from the clipboard

## data persistence
your task tree is automatically saved to your browser's local storage. this ensures your tasks will persist even if you close the browser or refresh the page. note that clearing your browser data may erase your saved tasks.

## browser compatibility
this application is designed to run on modern web browsers with javascript enabled. mobile browsers are supported, but a physical keyboard is required (for now).

## privacy
all data is stored locally on your machine. no data is sent to or stored on any external servers.

## license
this project is licensed under the <a href="https://github.com/hunterirving/matryoshka/blob/main/LICENSE">GNU general public license v3.0</a>.