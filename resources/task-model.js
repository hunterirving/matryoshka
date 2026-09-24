// Task model: state calculations, checkbox logic, tree traversal

function updateCheckboxState(checkbox, taskState) {
	checkbox.checked = taskState === 1;
	checkbox.indeterminate = taskState === 2;
}

function toggleTaskState(task) {
	// Save cursor position before re-rendering
	var taskInput = document.querySelector(`.task-container[data-id="${task.id}"] .task-text`);
	var cursorPos = taskInput ? getCaretOffset(taskInput) : null;

	if (task.state === 1) {
		if (task.subtasks.length === 0 || !task.subtasks.every(t => t.state === 1)) {
			task.state = 0;
			updateSubtasksState(task, 0);

			var parent = findParentTask(task);
			if (parent) {
				updateTaskAndAncestors(parent);
			}

			renderCurrentView();
			selectAndFocusTask(task, cursorPos);
			scheduleSave();
		} else {
			applyShakeAnimation(task.id);
		}
	} else {
		task.state = 1;
		updateSubtasksState(task, 1);

		var parent = findParentTask(task);
		if (parent) {
			updateTaskAndAncestors(parent);
		}

		renderCurrentView();
		selectAndFocusTask(task, cursorPos);
		scheduleSave();
	}
}

function recalculateTaskState(task) {
	if (task.subtasks.length === 0) {
		return task.state;
	}
	var anyUnchecked = task.subtasks.some(t => t.state === 0);
	var allChecked = task.subtasks.every(t => t.state === 1);
	var allCheckedOrIndeterminate = task.subtasks.every(t => t.state === 1 || t.state === 2);

	if (allChecked) {
		return 1;
	} else if (allCheckedOrIndeterminate) {
		return task.state === 2 ? 2 : 1;
	} else if (anyUnchecked) {
		return 0;
	}
}

function updateTaskAndAncestors(task) {
	var newState = recalculateTaskState(task);
	if (task.state !== newState) {
		var oldState = task.state;
		task.state = newState;

		if (oldState === 1 && newState === 0) {
			updateSubtasksState(task, 0);
		}

		var parent = findParentTask(task);
		if (parent) {
			updateTaskAndAncestors(parent);
		}
	}
}

function updateSubtasksState(task, newState) {
	task.subtasks.forEach(subtask => {
		if (subtask.state !== 1) {
			if (newState === 1) {
				subtask.state = subtask.state === 0 ? 2 : subtask.state;
			} else if (newState === 0) {
				subtask.state = 0;
			}
			if (subtask.subtasks.length > 0) {
				updateSubtasksState(subtask, newState);
			}
		}
	});
}

function adjustMovedTaskState(movedTask, newParent) {
	if (movedTask.state === 2 && newParent.state === 0) {
		movedTask.state = 0;
		updateSubtasksState(movedTask, 0);
	}
}

function findParentTask(task) {
	for (var i = state.taskPath.length - 1; i >= 0; i--) {
		var potentialParent = state.taskPath[i];
		if (potentialParent.subtasks.some(t => t.id === task.id)) {
			return potentialParent;
		}
	}
	return null;
}

function isLastSubtask(task) {
	var parentTask = findParentTask(task);
	if (!parentTask) return false;
	return parentTask.subtasks[parentTask.subtasks.length - 1].id === task.id;
}

function addNewSubtask(parentTask, currentSubtask = null) {
	var newSubtask = { id: generateId(), text: '', state: 0, subtasks: [], selectedSubtaskId: null };
	if (currentSubtask) {
		var index = parentTask.subtasks.findIndex(t => t.id === currentSubtask.id);
		parentTask.subtasks.splice(index + 1, 0, newSubtask);
	} else {
		parentTask.subtasks.push(newSubtask);
	}

	updateTaskAndAncestors(parentTask);
	renderCurrentView();
	selectAndFocusTask(newSubtask);
	scheduleSave();
}

function isEmptyTask(task) {
	return task.text === '' && task.subtasks.length === 0;
}

function cloneTaskWithNewIds(task) {
	var subtasks = task.subtasks.map(cloneTaskWithNewIds);
	var selectedIndex = task.subtasks.findIndex(t => t.id === task.selectedSubtaskId);
	return {
		id: generateId(),
		text: task.text,
		state: task.state,
		subtasks: subtasks,
		selectedSubtaskId: selectedIndex === -1 ? null : subtasks[selectedIndex].id
	};
}

function pasteCopiedTasks(targetTasks) {
	if (state.copiedTasks.length === 0) return;

	var pastedTasks = state.copiedTasks.map(cloneTaskWithNewIds);
	var parentTask = state.currentTask;
	if (targetTasks[0] === parentTask) {
		parentTask.subtasks.unshift(...pastedTasks);
	} else {
		var firstIndex = parentTask.subtasks.findIndex(t => t.id === targetTasks[0].id);
		var lastIndex = parentTask.subtasks.findIndex(t => t.id === targetTasks[targetTasks.length - 1].id);
		var isEmptySlot = targetTasks.every(isEmptyTask) && !state.copiedTasks.every(isEmptyTask);
		if (isEmptySlot) {
			parentTask.subtasks.splice(firstIndex, targetTasks.length, ...pastedTasks);
		} else {
			parentTask.subtasks.splice(lastIndex + 1, 0, ...pastedTasks);
		}
	}
	pastedTasks.forEach(t => adjustMovedTaskState(t, parentTask));
	updateTaskAndAncestors(parentTask);

	clearMultiSelect();
	var lastPasted = pastedTasks[pastedTasks.length - 1];
	if (pastedTasks.length > 1) {
		state.multiSelectAnchorId = pastedTasks[0].id;
		state.multiSelectedIds = pastedTasks.map(t => t.id);
		pastedTasks.forEach(t => state.multiCaretOffsets[t.id] = t.text.length);
	}
	parentTask.selectedSubtaskId = lastPasted.id;
	renderCurrentView();
	pastedTasks.forEach(t => applyShakeAnimation(t.id, 'vertical'));
	scheduleSave();
}

function deleteTask(task) {
	if (task === state.taskPath[0]) {
		applyShakeAnimation(task.id);
		return;
	}
	clearMultiSelect();
	if (task === state.currentTask) {
		deleteCurrentParentTask();
	} else {
		deleteSubtask(task);
	}
}

function deleteSubtask(subtask) {
	var parentTask = state.taskPath[state.taskPath.length - 1];
	var index = parentTask.subtasks.findIndex(t => t.id === subtask.id);

	if (parentTask.id === 'root' && parentTask.subtasks.length === 1) {
		applyShakeAnimation(subtask.id);
		return;
	}

	parentTask.subtasks = parentTask.subtasks.filter(t => t.id !== subtask.id);
	updateTaskAndAncestors(parentTask);

	if (parentTask.subtasks.length === 0 && state.taskPath.length > 1) {
		navigateToParentTask();
	} else {
		renderCurrentView();
		if (parentTask.subtasks.length > 0) {
			var targetIndex = Math.max(0, index - 1);
			selectAndFocusTask(parentTask.subtasks[targetIndex]);
		} else {
			selectAndFocusTask(parentTask);
		}
	}
	scheduleSave();
}

function deleteCurrentParentTask() {
	if (state.taskPath.length <= 1) return;

	var currentParentTask = state.taskPath[state.taskPath.length - 1];
	var grandparentTask = state.taskPath[state.taskPath.length - 2];

	if (grandparentTask.id === 'root' && grandparentTask.subtasks.length === 1) {
		applyShakeAnimation(currentParentTask.id);
		return;
	}

	var index = grandparentTask.subtasks.findIndex(t => t.id === currentParentTask.id);

	grandparentTask.subtasks = grandparentTask.subtasks.filter(t => t.id !== currentParentTask.id);
	updateTaskAndAncestors(grandparentTask);

	state.taskPath.pop();
	state.currentTask = grandparentTask;

	if (grandparentTask.subtasks.length === 0 && state.taskPath.length > 1) {
		navigateToParentTask();
	} else {
		renderCurrentView();
		if (grandparentTask.subtasks.length > 0) {
			var targetIndex = Math.max(0, index - 1);
			selectAndFocusTask(grandparentTask.subtasks[targetIndex]);
		} else {
			selectAndFocusTask(grandparentTask);
		}
	}
	scheduleSave();
}
