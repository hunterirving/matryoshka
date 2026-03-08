// Navigation: moving between tasks, navigating into/out of subtask levels

function navigateTasks(direction) {
	var tasks = state.currentTask.subtasks;
	var subtaskIndex = tasks.findIndex(t => t.id === state.currentTask.selectedSubtaskId);

	var currentElement = document.activeElement;
	var currentContainer = currentElement ? currentElement.closest('.task-container') : null;
	var isParentFocused = currentContainer && currentContainer.dataset.id == state.currentTask.id;

	if (direction === 'up') {
		if (isParentFocused) {
			// Already at parent, can't go higher
		} else if (subtaskIndex <= 0) {
			selectAndFocusTask(state.currentTask);
		} else {
			selectAndFocusTask(tasks[subtaskIndex - 1]);
		}
	} else {
		if (isParentFocused) {
			if (tasks.length > 0) {
				selectAndFocusTask(tasks[0]);
			}
		} else if (subtaskIndex >= 0 && subtaskIndex < tasks.length - 1) {
			selectAndFocusTask(tasks[subtaskIndex + 1]);
		}
	}
	state.lastSubtaskDownArrowReleased = false;
	state.lastSubtaskShiftDownReleased = false;
}

function navigateIntoSubtask(subtask) {
	document.documentElement.style.scrollBehavior = 'auto';

	if (subtask.subtasks.length > 0) {
		state.currentTask.selectedSubtaskId = subtask.id;
		state.taskPath.push(subtask);
		state.currentTask = subtask;
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		var selectedSubtask = subtask.selectedSubtaskId ?
			subtask.subtasks.find(t => t.id === subtask.selectedSubtaskId) :
			subtask.subtasks[0];
		selectAndFocusTask(selectedSubtask);
	} else {
		addNewSubtask(subtask);
		state.currentTask.selectedSubtaskId = subtask.id;
		state.taskPath.push(subtask);
		state.currentTask = subtask;
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		selectAndFocusTask(subtask.subtasks[0]);
	}
}

function navigateIntoTaskAndSelectSubtask(targetTask, subtaskToSelect) {
	document.documentElement.style.scrollBehavior = 'auto';

	state.currentTask.selectedSubtaskId = targetTask.id;

	state.taskPath.push(targetTask);
	state.currentTask = targetTask;
	updateBreadcrumbs(state.currentTask);
	renderCurrentView();

	selectAndFocusTask(subtaskToSelect);
	state.currentTask.selectedSubtaskId = subtaskToSelect.id;
}

function navigateToParentTask() {
	if (state.currentTask.id === 'root') {
		var activeTaskElement = document.querySelector('.task-container.active');
		if (activeTaskElement) {
			var taskId = activeTaskElement.dataset.id;
			applyShakeAnimation(taskId);
		}
	} else if (state.taskPath.length > 1) {
		document.documentElement.style.scrollBehavior = 'auto';

		var currentTaskId = state.currentTask.id;
		state.taskPath.pop();
		state.currentTask = state.taskPath[state.taskPath.length - 1];
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		var selectedSubtask = state.currentTask.subtasks.find(t => t.id === currentTaskId);
		if (selectedSubtask) {
			selectAndFocusTask(selectedSubtask);
		} else if (state.currentTask.subtasks.length > 0) {
			selectAndFocusTask(state.currentTask.subtasks[0]);
		} else {
			selectAndFocusTask(state.currentTask);
		}
		state.currentTask.selectedSubtaskId = currentTaskId;
	}
}

function navigateToParentTaskAndSelectTask(targetTask) {
	if (state.currentTask.id === 'root') {
		renderCurrentView();
		selectAndFocusTask(targetTask);
	} else if (state.taskPath.length > 1) {
		document.documentElement.style.scrollBehavior = 'auto';

		state.taskPath.pop();
		state.currentTask = state.taskPath[state.taskPath.length - 1];
		updateBreadcrumbs(state.currentTask);
		renderCurrentView();
		selectAndFocusTask(targetTask);
		state.currentTask.selectedSubtaskId = targetTask.id;
	}
}
