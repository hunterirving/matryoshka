// Multi-select: state management and bulk operations

function clearMultiSelect() {
	state.multiSelectAnchorId = null;
	state.multiSelectedIds = [];
	var focused = document.activeElement;
	var focusedContainer = focused ? focused.closest('.task-container') : null;
	document.querySelectorAll('.task-container.active').forEach(el => {
		if (el !== focusedContainer) el.classList.remove('active');
	});
}

function getMultiSelectedTasks() {
	return state.currentTask.subtasks.filter(t => state.multiSelectedIds.includes(t.id));
}

function applyMultiSelectHighlights() {
	for (var id of state.multiSelectedIds) {
		var container = document.querySelector(`.task-container[data-id="${id}"]`);
		if (container) container.classList.add('active');
	}
}

function shakeAllSelected(direction = 'horizontal') {
	for (var id of state.multiSelectedIds) {
		applyShakeAnimation(id, direction);
	}
}

function extendMultiSelect(task, direction) {
	if (task === state.currentTask) return;

	var tasks = state.currentTask.subtasks;
	if (tasks.length === 0) return;

	if (state.multiSelectAnchorId === null) {
		state.multiSelectAnchorId = task.id;
		state.multiSelectedIds = [task.id];
	}

	var anchorIndex = tasks.findIndex(t => t.id === state.multiSelectAnchorId);
	var currentIndex = tasks.findIndex(t => t.id === task.id);

	if (direction === 'down') {
		var bottomIndex = tasks.findIndex((t, i) => {
			return state.multiSelectedIds.includes(t.id) &&
				(i === tasks.length - 1 || !state.multiSelectedIds.includes(tasks[i + 1].id));
		});
		if (currentIndex <= anchorIndex && state.multiSelectedIds.length > 1) {
			state.multiSelectedIds = state.multiSelectedIds.filter(id => id !== task.id);
			var nextTask = tasks[currentIndex + 1];
			if (nextTask) selectAndFocusTask(nextTask);
		} else if (bottomIndex < tasks.length - 1) {
			var nextTask = tasks[bottomIndex + 1];
			state.multiSelectedIds.push(nextTask.id);
			selectAndFocusTask(nextTask);
		}
	} else {
		var topIndex = tasks.findIndex(t => state.multiSelectedIds.includes(t.id));
		if (currentIndex >= anchorIndex && state.multiSelectedIds.length > 1) {
			state.multiSelectedIds = state.multiSelectedIds.filter(id => id !== task.id);
			var prevTask = tasks[currentIndex - 1];
			if (prevTask) selectAndFocusTask(prevTask);
		} else if (topIndex > 0) {
			var prevTask = tasks[topIndex - 1];
			state.multiSelectedIds.unshift(prevTask.id);
			selectAndFocusTask(prevTask);
		}
	}

	applyMultiSelectHighlights();
}

function moveMultiSelected(direction) {
	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return false;

	var subtasks = state.currentTask.subtasks;
	var indices = selected.map(t => subtasks.findIndex(s => s.id === t.id)).sort((a, b) => a - b);
	var topIndex = indices[0];
	var bottomIndex = indices[indices.length - 1];

	if (direction === 'up' && topIndex <= 0) return false;
	if (direction === 'down' && bottomIndex >= subtasks.length - 1) return false;

	var chunk = subtasks.splice(topIndex, selected.length);
	var insertAt = direction === 'up' ? topIndex - 1 : topIndex + 1;
	subtasks.splice(insertAt, 0, ...chunk);

	state.currentTask.selectedSubtaskId = state.multiSelectAnchorId;
	renderCurrentView();
	applyMultiSelectHighlights();
	scheduleSave();
	return true;
}

function pushMultiSelectedIntoTarget(direction, navigate = false) {
	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return false;

	if (navigate) {
		document.documentElement.style.scrollBehavior = 'auto';
	}

	var subtasks = state.currentTask.subtasks;
	var indices = selected.map(t => subtasks.findIndex(s => s.id === t.id)).sort((a, b) => a - b);
	var topIndex = indices[0];
	var bottomIndex = indices[indices.length - 1];

	var targetTask = null;
	if (direction === 'up' && topIndex > 0) {
		targetTask = subtasks[topIndex - 1];
	} else if (direction === 'down' && bottomIndex < subtasks.length - 1) {
		targetTask = subtasks[bottomIndex + 1];
	}
	if (!targetTask) return false;

	var chunk = selected.slice();
	state.currentTask.subtasks = state.currentTask.subtasks.filter(t => !state.multiSelectedIds.includes(t.id));

	targetTask.subtasks.unshift(...chunk);

	for (var t of chunk) {
		adjustMovedTaskState(t, targetTask);
	}
	targetTask.selectedSubtaskId = state.multiSelectAnchorId;
	updateTaskAndAncestors(state.currentTask);
	updateTaskAndAncestors(targetTask);

	if (navigate) {
		state.currentTask.selectedSubtaskId = targetTask.id;
		state.taskPath.push(targetTask);
		state.currentTask = targetTask;
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		applyMultiSelectHighlights();
	} else {
		clearMultiSelect();
		renderCurrentView();
		selectAndFocusTask(targetTask);
	}

	scheduleSave();
	return true;
}

function pullMultiSelectedOutLayer(navigate = false) {
	if (state.taskPath.length <= 1) return false;

	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return false;

	if (navigate) {
		document.documentElement.style.scrollBehavior = 'auto';
	}

	var currentParent = state.currentTask;
	var grandParent = state.taskPath[state.taskPath.length - 2];
	if (!grandParent) return false;

	currentParent.subtasks = currentParent.subtasks.filter(t => !state.multiSelectedIds.includes(t.id));

	var parentIndex = grandParent.subtasks.findIndex(t => t.id === currentParent.id);
	if (parentIndex === -1) {
		grandParent.subtasks.push(...selected);
	} else {
		grandParent.subtasks.splice(parentIndex + 1, 0, ...selected);
	}

	for (var t of selected) {
		adjustMovedTaskState(t, grandParent);
	}

	updateTaskAndAncestors(currentParent);
	updateTaskAndAncestors(grandParent);

	if (navigate || currentParent.subtasks.length === 0) {
		state.taskPath.pop();
		state.currentTask = state.taskPath[state.taskPath.length - 1];
		state.currentTask.selectedSubtaskId = state.multiSelectAnchorId;
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		applyMultiSelectHighlights();
	} else {
		clearMultiSelect();
		renderCurrentView();
		if (currentParent.subtasks.length > 0) {
			selectAndFocusTask(currentParent.subtasks[0]);
		} else {
			selectAndFocusTask(currentParent);
		}
	}

	scheduleSave();
	return true;
}

function bulkToggleTaskState() {
	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return;

	var anyUnchecked = selected.some(t => t.state !== 1);
	var newState = anyUnchecked ? 1 : 0;

	for (var t of selected) {
		function setAllSubtasks(task, s) {
			task.state = s;
			for (var sub of task.subtasks) {
				setAllSubtasks(sub, s);
			}
		}
		setAllSubtasks(t, newState);
	}

	updateTaskAndAncestors(state.currentTask);
	state.currentTask.selectedSubtaskId = state.multiSelectAnchorId;
	renderCurrentView();
	applyMultiSelectHighlights();
	scheduleSave();
}
