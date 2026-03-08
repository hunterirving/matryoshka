// Render: view rendering, breadcrumbs, UI updates, and shared DOM helpers

function generateBreadcrumbs(rootTask, currentPath, selectedTaskId) {
	var breadcrumbs = '';
	var currentTask = rootTask;
	var currentDepth = 0;

	for (var i = 0; i < currentPath.length - 1; i++) {
		breadcrumbs += '○ ';
		currentTask = currentTask.subtasks.find(t => t.id === currentPath[i + 1].id);
	}

	breadcrumbs += '● ';
	currentDepth = currentPath.length - 1;

	if (selectedTaskId !== currentTask.id) {
		var selectedTask = currentTask.subtasks.find(t => t.id === selectedTaskId);

		if (selectedTask) {
			function calculateMaxDepth(task, depth) {
				if (task.subtasks.length === 0) return depth;
				return Math.max(...task.subtasks.map(st => calculateMaxDepth(st, depth + 1)));
			}

			var maxDepth = calculateMaxDepth(selectedTask, currentDepth + 1);

			for (var i = currentDepth + 1; i < maxDepth; i++) {
				breadcrumbs += '○ ';
			}
		}
	}

	return breadcrumbs.trim();
}

function applyShakeAnimation(taskId, direction = 'horizontal') {
	var checkbox = document.querySelector(`.task-container[data-id="${taskId}"] .checkbox-label`);
	if (checkbox) {
		var className = direction === 'vertical' ? 'shake-vertical' : 'shake';
		if (checkbox.dataset.shaking) return;
		checkbox.dataset.shaking = '1';
		checkbox.classList.add(className);
		checkbox.addEventListener('animationend', () => {
			checkbox.classList.remove(className);
		}, { once: true });
		var clearShaking = () => {
			delete checkbox.dataset.shaking;
			document.removeEventListener('keyup', clearShaking);
		};
		document.addEventListener('keyup', clearShaking);
	}
}

function selectAndFocusTask(task, cursorPos) {
	var taskInput = document.querySelector(`.task-container[data-id="${task.id}"] input[type="text"]`);
	if (taskInput) {
		taskInput.focus();
		var pos = cursorPos != null ? cursorPos : taskInput.value.length;
		taskInput.setSelectionRange(pos, pos);
		setActiveTask(taskInput, task);
	}
}

function placeCursorAtBeginning(input) {
	input.setSelectionRange(0, 0);
}

function setActiveTask(input, task) {
	document.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
	input.closest('.task-container').classList.add('active');
	if (task !== state.currentTask) {
		state.currentTask.selectedSubtaskId = task.id;
	}
	// Re-apply multi-select highlights after clearing
	if (state.multiSelectedIds.length > 1) {
		applyMultiSelectHighlights();
	}
	updateBreadcrumbs(task);
	// During multi-select, check bottommost selected task for "last subtask" status
	var bottomTask = state.multiSelectedIds.length > 1
		? getMultiSelectedTasks().slice(-1)[0]
		: task;
	state.lastSubtaskDownArrowReleased = isLastSubtask(bottomTask);
	state.lastSubtaskShiftDownReleased = isLastSubtask(bottomTask);
	input.focus();

	// Center the active task in the viewport
	var activeTaskElement = input.closest('.task-container');
	if (activeTaskElement && activeTaskElement.parentElement && activeTaskElement.parentElement.tagName === 'LI') {
		activeTaskElement.scrollIntoView({
			behavior: 'auto',
			block: 'center',
			inline: 'nearest'
		});

		setTimeout(() => {
			document.documentElement.style.scrollBehavior = 'smooth';
		}, 200);
	}
}

function updateBreadcrumbs(selectedTask) {
	var breadcrumbsContainer = document.getElementById('breadcrumbs');
	var effectiveId = state.multiSelectedIds.length > 1 ? state.currentTask.id : selectedTask.id;
	var trail = generateBreadcrumbs(state.taskPath[0], state.taskPath, effectiveId);
	breadcrumbsContainer.textContent = trail;
}

function updatePageTitle(task) {
	document.title = task.text || '?';
}

function selectFirstSubtask() {
	if (state.currentTask.subtasks.length > 0) {
		var firstSubtask = state.currentTask.subtasks[0];
		selectAndFocusTask(firstSubtask);
	} else {
		selectAndFocusTask(state.currentTask);
	}
}

function handleCopyAndCut(e) {
	if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
		var activeTaskInput = document.querySelector('.task-container.active input[type="text"]');
		if (activeTaskInput) {
			e.preventDefault();

			if (activeTaskInput.selectionStart === activeTaskInput.selectionEnd) {
				activeTaskInput.select();
			}

			if (e.key === 'c') {
				document.execCommand('copy');
			} else if (e.key === 'x') {
				document.execCommand('cut');

				var taskContainer = activeTaskInput.closest('.task-container');
				var taskId = taskContainer.dataset.id;
				var task = state.currentTask.id === taskId ? state.currentTask : state.currentTask.subtasks.find(t => t.id === taskId);
				if (task) {
					task.text = activeTaskInput.value;
					scheduleSave();
				}
			}

			if (e.key === 'c' && activeTaskInput.selectionStart === 0 && activeTaskInput.selectionEnd === activeTaskInput.value.length) {
				activeTaskInput.setSelectionRange(activeTaskInput.value.length, activeTaskInput.value.length);
			}
		}
	}
}

function renderCurrentView() {
	state.appContainer.innerHTML = '';
	state.currentTask = state.taskPath[state.taskPath.length - 1];

	var stickyHeader = document.createElement('div');
	stickyHeader.className = 'sticky-header';

	var breadcrumbsElement = document.createElement('div');
	breadcrumbsElement.id = 'breadcrumbs';
	stickyHeader.appendChild(breadcrumbsElement);

	var parentElement = createTaskElement(state.currentTask, true);
	stickyHeader.appendChild(parentElement);

	state.appContainer.appendChild(stickyHeader);

	var subtasksContainer = document.createElement('div');
	subtasksContainer.id = 'subtasks-container';

	var subtasksList = document.createElement('ul');
	state.currentTask.subtasks.forEach(subtask => {
		var li = document.createElement('li');
		li.appendChild(createTaskElement(subtask));
		subtasksList.appendChild(li);
	});
	subtasksContainer.appendChild(subtasksList);
	state.appContainer.appendChild(subtasksContainer);

	updateBreadcrumbs(state.currentTask);
	updatePageTitle(state.currentTask);

	var parentCheckbox = parentElement.querySelector('input[type="checkbox"]');
	updateCheckboxState(parentCheckbox, state.currentTask.state);

	if (state.currentTask.selectedSubtaskId) {
		var selectedTask = state.currentTask.subtasks.find(t => t.id === state.currentTask.selectedSubtaskId);
		if (selectedTask) {
			selectAndFocusTask(selectedTask);
		} else {
			selectFirstSubtask();
		}
	} else {
		selectFirstSubtask();
	}
}
