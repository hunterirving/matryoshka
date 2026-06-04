// Render: view rendering, breadcrumbs, UI updates, and shared DOM helpers

function getCaretOffset(el) {
	var sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null;
	var range = sel.getRangeAt(0);
	var pre = range.cloneRange();
	pre.selectNodeContents(el);
	pre.setEnd(range.endContainer, range.endOffset);
	return pre.toString().length;
}

function setCaretOffset(el, offset) {
	el.focus();
	var node = el.firstChild;
	var range = document.createRange();
	var sel = window.getSelection();
	var pos = 0;
	if (node && node.nodeType === Node.TEXT_NODE) {
		pos = Math.max(0, Math.min(offset, node.textContent.length));
		range.setStart(node, pos);
	} else {
		range.setStart(el, 0);
	}
	range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
	// browsers don't auto-scroll a programmatic caret, so do it manually
	scrollCaretIntoView(el, range, pos);
}

function scrollCaretIntoView(el, range, pos) {
	if (pos >= el.textContent.length) {
		el.scrollLeft = el.scrollWidth;
		return;
	}
	if (pos <= 0) {
		el.scrollLeft = 0;
		return;
	}
	var caretRect = range.getBoundingClientRect();
	var elRect = el.getBoundingClientRect();
	var pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
	if (caretRect.right > elRect.right - pad) {
		el.scrollLeft += caretRect.right - (elRect.right - pad);
	} else if (caretRect.left < elRect.left) {
		el.scrollLeft -= elRect.left - caretRect.left;
	}
}

function selectAllText(el) {
	var range = document.createRange();
	range.selectNodeContents(el);
	var sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
}

function rescrollActiveCaret() {
	var el = document.querySelector('.task-container.active .task-text');
	if (el) setCaretOffset(el, getCaretOffset(el) || 0);
}

function isSelectionCollapsed() {
	var sel = window.getSelection();
	return !sel || sel.isCollapsed;
}

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
	var taskInput = document.querySelector(`.task-container[data-id="${task.id}"] .task-text`);
	if (taskInput) {
		taskInput.focus();
		var pos = cursorPos != null ? cursorPos : taskInput.textContent.length;
		setCaretOffset(taskInput, pos);
		setActiveTask(taskInput, task);
	}
}

function placeCursorAtBeginning(input) {
	input.scrollLeft = 0;
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
		var activeTaskInput = document.querySelector('.task-container.active .task-text');
		if (activeTaskInput) {
			e.preventDefault();

			// With no selection, act on the whole task text
			var collapsed = isSelectionCollapsed();
			if (collapsed) {
				selectAllText(activeTaskInput);
			}

			if (e.key === 'c') {
				document.execCommand('copy');
			} else if (e.key === 'x') {
				document.execCommand('cut');

				var taskContainer = activeTaskInput.closest('.task-container');
				var taskId = taskContainer.dataset.id;
				var task = state.currentTask.id === taskId ? state.currentTask : state.currentTask.subtasks.find(t => t.id === taskId);
				if (task) {
					task.text = activeTaskInput.textContent;
					scheduleSave();
				}
			}

			// After a copy that auto-selected everything, collapse the caret to the end
			if (e.key === 'c' && collapsed) {
				setCaretOffset(activeTaskInput, activeTaskInput.textContent.length);
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
