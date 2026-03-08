// Storage: localStorage persistence, file import/export, serialization

function scheduleSave() {
	if (state.saveTimer) {
		clearTimeout(state.saveTimer);
	}
	state.saveTimer = setTimeout(saveTasksToLocalStorage, 1000);
}

function saveTasksToLocalStorage() {
	var serializedTasks = serializeTaskTree(state.taskPath[0]);
	localStorage.setItem('taskTree', serializedTasks);
	state.saveTimer = null;
}

function serializeTaskTree(task, depth = 0) {
	var indentation = '\t'.repeat(depth);
	var status = task.state === 0 ? '_' : (task.state === 1 ? 'x' : '?');
	var serialized = `${indentation}${status} ${task.text}\n`;

	for (var subtask of task.subtasks) {
		serialized += serializeTaskTree(subtask, depth + 1);
	}

	return serialized;
}

function deserializeTaskTree(serialized) {
	var lines = serialized.split('\n').filter(line => line.trim() !== '');
	var root = { id: 'root', subtasks: [] };
	var stack = [{ task: root, depth: -1 }];

	for (var line of lines) {
		var depth = (line.match(/^\t*/)[0] || '').length;
		var status = line[depth];
		var text = line.slice(depth + 2);

		var newTask = {
			id: depth === 0 ? 'root' : generateId(),
			text: text,
			state: status === '_' ? 0 : (status === 'x' ? 1 : 2),
			subtasks: [],
			selectedSubtaskId: null
		};

		while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
			stack.pop();
		}

		if (depth === 0) {
			Object.assign(root, newTask);
		} else {
			stack[stack.length - 1].task.subtasks.push(newTask);
		}
		stack.push({ task: newTask, depth: depth });
	}

	return root;
}

function loadTasksFromLocalStorage() {
	var savedTasks = localStorage.getItem('taskTree');
	if (savedTasks) {
		console.log('%cloaded tasks from local storage:', "color: green;");
		console.log(savedTasks);
		return deserializeTaskTree(savedTasks);
	} else {
		return { id: 'root', text: 'todo', state: 0, subtasks: [{ id: generateId(), text: '', state: 0, subtasks: [] }], selectedSubtaskId: null };
	}
}

function handleSave(e) {
	if ((e.metaKey || e.ctrlKey) && e.key === 's') {
		e.preventDefault();
		saveTaskTreeToFile();
	}
}

function saveTaskTreeToFile() {
	var serializedTasks = serializeTaskTree(state.taskPath[0]);
	var rootTaskName = state.taskPath[0].text || 'Untitled';
	var date = new Date();
	var fileName = `${rootTaskName} - ${date.toLocaleString('default', { month: 'short' }).toLowerCase()} ${date.getDate()}, '${date.getFullYear().toString().slice(-2)}.txt`;

	var blob = new Blob([serializedTasks], { type: 'text/plain' });
	var url = URL.createObjectURL(blob);

	var a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();

	URL.revokeObjectURL(url);
}

function handleOpen(e) {
	if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
		e.preventDefault();
		openTaskTreeFromFile();
	}
}

function openTaskTreeFromFile() {
	var input = document.createElement('input');
	input.type = 'file';
	input.accept = '.txt';
	input.onchange = function(event) {
		var file = event.target.files[0];
		var reader = new FileReader();
		reader.onload = function(e) {
			try {
				var newRootTask = deserializeTaskTree(e.target.result);
				if (confirm('Are you sure you want to overwrite the existing task tree?')) {
					state.rootTask = newRootTask;
					state.currentTask = state.rootTask;
					state.taskPath = [state.currentTask];
					renderCurrentView();
					saveTasksToLocalStorage();
				}
			} catch (error) {
				alert(`Error importing task tree: ${error.message}`);
			}
		};
		reader.readAsText(file);
	};
	input.click();
}
