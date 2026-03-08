// Reorganize: single-task move, push, and pull operations

function moveSubtask(subtask, direction) {
	if (subtask === state.currentTask) return false;

	var parentTask = findParentTask(subtask);
	if (!parentTask) return false;

	var index = parentTask.subtasks.findIndex(t => t.id === subtask.id);
	if (index === -1) return false;

	if (direction === 'up' && index > 0) {
		[parentTask.subtasks[index - 1], parentTask.subtasks[index]] = [parentTask.subtasks[index], parentTask.subtasks[index - 1]];
	} else if (direction === 'down' && index < parentTask.subtasks.length - 1) {
		[parentTask.subtasks[index], parentTask.subtasks[index + 1]] = [parentTask.subtasks[index + 1], parentTask.subtasks[index]];
	} else {
		return false;
	}

	renderCurrentView();
	selectAndFocusTask(subtask);
	scheduleSave();
	return true;
}

function pushSubtaskIntoTarget(subtask, direction, navigate = false) {
	if (subtask === state.currentTask) return false;

	if (navigate) {
		document.documentElement.style.scrollBehavior = 'auto';
	}

	var parentTask = findParentTask(subtask);
	if (!parentTask) return false;

	var index = parentTask.subtasks.findIndex(t => t.id === subtask.id);
	if (index === -1) return false;

	var targetTask = null;
	if (direction === 'up' && index > 0) {
		targetTask = parentTask.subtasks[index - 1];
	} else if (direction === 'down' && index < parentTask.subtasks.length - 1) {
		targetTask = parentTask.subtasks[index + 1];
	}

	if (!targetTask) return false;

	parentTask.subtasks.splice(index, 1);
	targetTask.subtasks.unshift(subtask);
	targetTask.selectedSubtaskId = subtask.id;

	adjustMovedTaskState(subtask, targetTask);
	updateTaskAndAncestors(parentTask);
	updateTaskAndAncestors(targetTask);

	if (navigate) {
		navigateIntoTaskAndSelectSubtask(targetTask, subtask);
	} else {
		renderCurrentView();
		selectAndFocusTask(targetTask);
	}

	scheduleSave();
	return true;
}

function pullSubtaskOutLayer(subtask, navigate = false) {
	if (subtask === state.currentTask) return false;
	if (state.taskPath.length <= 1) return false;

	if (navigate) {
		document.documentElement.style.scrollBehavior = 'auto';
	}

	var currentParent = findParentTask(subtask);
	if (!currentParent) return;

	var grandParent = findParentTask(currentParent);
	if (!grandParent) return;

	var currentIndex = currentParent.subtasks.findIndex(t => t.id === subtask.id);
	if (currentIndex === -1) return;
	currentParent.subtasks.splice(currentIndex, 1);

	var currentParentIndex = grandParent.subtasks.findIndex(t => t.id === currentParent.id);
	if (currentParentIndex === -1) {
		grandParent.subtasks.push(subtask);
	} else {
		grandParent.subtasks.splice(currentParentIndex + 1, 0, subtask);
	}

	adjustMovedTaskState(subtask, grandParent);
	updateTaskAndAncestors(currentParent);
	updateTaskAndAncestors(grandParent);

	if (navigate || (currentParent.subtasks.length === 0 && state.taskPath.length > 1)) {
		navigateToParentTaskAndSelectTask(subtask);
	} else {
		renderCurrentView();
		if (currentParent.subtasks.length > 0) {
			var targetIndex = Math.max(0, currentIndex - 1);
			selectAndFocusTask(currentParent.subtasks[targetIndex]);
		} else {
			selectAndFocusTask(currentParent);
		}
	}

	scheduleSave();
	return true;
}
