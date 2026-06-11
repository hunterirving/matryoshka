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
	var focused = document.activeElement;
	// in multi-select every row is .active; prefer the truly focused line
	if (focused && focused.classList && focused.classList.contains('task-text')) el = focused;
	if (!el) return;
	var sel = window.getSelection();
	// keep a live range selection; resetting the caret would collapse it
	if (sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode)) {
		scrollCaretIntoView(el, sel.getRangeAt(0), getCaretOffset(el) || 0);
		renderSimCarets();
		return;
	}
	setCaretOffset(el, getCaretOffset(el) || 0);
}

// capture/restore the focused line's text selection across a re-render,
// which destroys the DOM nodes the live selection points at
function captureActiveSelection() {
	var el = document.activeElement;
	if (!el || !el.classList || !el.classList.contains('task-text')) return null;
	var sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !el.contains(sel.anchorNode)) return null;
	var container = el.closest('.task-container');
	if (!container) return null;
	var end = getCaretOffset(el);
	if (end == null) return null;
	return { id: container.dataset.id, start: end - sel.toString().length, end: end };
}

function restoreActiveSelection(saved) {
	if (!saved) return;
	var input = document.querySelector(`.task-container[data-id="${saved.id}"] .task-text`);
	var node = input ? input.firstChild : null;
	if (!node || node.nodeType !== Node.TEXT_NODE) return;
	var range = document.createRange();
	range.setStart(node, Math.max(0, Math.min(saved.start, node.textContent.length)));
	range.setEnd(node, Math.max(0, Math.min(saved.end, node.textContent.length)));
	var sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
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
		// restart cleanly if a prior shake is still mid-animation
		checkbox.classList.remove('shake', 'shake-vertical');
		void checkbox.offsetWidth;
		checkbox.classList.add(className);
		checkbox.addEventListener('animationend', () => {
			checkbox.classList.remove(className);
		}, { once: true });
		// also clear on the next fresh keydown
		var clearShaking = (ev) => {
			if (ev.type === 'keydown' && ev.repeat) return;
			delete checkbox.dataset.shaking;
			document.removeEventListener('keyup', clearShaking);
			document.removeEventListener('keydown', clearShaking, true);
		};
		document.addEventListener('keyup', clearShaking);
		document.addEventListener('keydown', clearShaking, true);
	}
}

// Simulated carets: the native caret is hidden app-wide (caret-color) so the
// caret looks identical across OSes and between single- and multi-select.
// Single mode mirrors the hidden native caret; multi mode uses the tracked
// per-line offsets. Carets hide on window blur and behind range selections.
function renderSimCarets() {
	var multi = state.multiSelectedIds.length > 1;
	var focusedEl = document.activeElement;
	if (!focusedEl || !focusedEl.classList || !focusedEl.classList.contains('task-text')) focusedEl = null;
	var sel = window.getSelection();
	var focusedHasRange = !!(focusedEl && sel && sel.rangeCount > 0 && !sel.isCollapsed && focusedEl.contains(sel.anchorNode));

	document.querySelectorAll('.sim-caret').forEach(el => {
		var container = el.closest('.task-container');
		var id = container ? container.dataset.id : null;
		var keep = multi ? state.multiSelectedIds.includes(id) : !!(focusedEl && container && container.contains(focusedEl));
		if (!keep) el.remove();
	});

	if (multi) {
		for (var t of getMultiSelectedTasks()) {
			var container = document.querySelector(`.task-container[data-id="${t.id}"]`);
			if (!container) continue;
			var offset = clampCaret(t.text, state.multiCaretOffsets[t.id]);
			state.multiCaretOffsets[t.id] = offset;
			var isFocusedLine = !!(focusedEl && container.contains(focusedEl));
			// a line showing a selection shows no caret, like native
			var lineHasRange = isFocusedLine ? focusedHasRange : !!getMultiRange(t);
			positionSimCaret(container, offset, !state.windowFocused || lineHasRange);
		}
		updateMultiRangeStyles();
	} else if (focusedEl) {
		var container = focusedEl.closest('.task-container');
		var offset = getCaretOffset(focusedEl);
		if (container) {
			if (offset == null) {
				var stray = container.querySelector('.sim-caret');
				if (stray) stray.remove();
			} else {
				positionSimCaret(container, offset, !state.windowFocused || focusedHasRange);
			}
		}
	}
}

function positionSimCaret(container, offset, hidden) {
	var textEl = container.querySelector('.task-text');
	var caretEl = container.querySelector('.sim-caret');
	if (!caretEl) {
		caretEl = document.createElement('div');
		caretEl.className = 'sim-caret';
		container.appendChild(caretEl);
	}
	var containerRect = container.getBoundingClientRect();
	var textRect = textEl.getBoundingClientRect();
	// client rects include the body zoom but style px get re-zoomed, so unscale
	var scale = container.offsetWidth ? containerRect.width / container.offsetWidth : 1;
	var x = textRect.left;
	var top = textRect.top;
	var height = textRect.height;
	var node = textEl.firstChild;
	if (node && node.nodeType === Node.TEXT_NODE) {
		var range = document.createRange();
		range.setStart(node, Math.min(offset, node.textContent.length));
		range.collapse(true);
		// keep each line scrolled so its own insertion point stays visible
		scrollCaretIntoView(textEl, range, offset);
		var rect = range.getBoundingClientRect();
		if (rect.height > 0) {
			x = rect.left;
			top = rect.top;
			height = rect.height;
		}
	} else {
		// empty line: the element box (padding + min-height) is taller than a
		// caret; approximate the line box from font metrics instead
		var styles = getComputedStyle(textEl);
		height = parseFloat(styles.fontSize) * 1.15 * scale;
		top = textRect.top + (parseFloat(styles.paddingTop) || 0) * scale;
	}
	// keep the caret inside the line's visible text box
	x = Math.max(textRect.left, Math.min(x, textRect.right - 1));
	// snap to whole zoomed pixels and size to exactly one, so the caret
	// never straddles a pixel boundary and fattens to 2px
	caretEl.style.left = (Math.round(x - containerRect.left) / scale) + 'px';
	caretEl.style.top = ((top - containerRect.top) / scale) + 'px';
	caretEl.style.height = (height / scale) + 'px';
	caretEl.style.width = (1 / scale) + 'px';
	if (hidden) {
		caretEl.style.visibility = 'hidden';
		return;
	}
	caretEl.style.visibility = '';
	caretEl.style.backgroundColor = getComputedStyle(textEl).color;
	// restart the blink so all carets stay in phase
	caretEl.style.animation = 'none';
	void caretEl.offsetWidth;
	caretEl.style.animation = '';
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
		// copy/cut are disabled during multi-select (no single "true" line)
		if (state.multiSelectedIds.length > 1) {
			e.preventDefault();
			return;
		}
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
			// during multi-select, keep the focused line's caret where it was
			var pos = state.multiCaretOffsets[selectedTask.id];
			selectAndFocusTask(selectedTask, typeof pos === 'number' ? pos : undefined);
		} else {
			selectFirstSubtask();
		}
	} else {
		selectFirstSubtask();
	}
}
