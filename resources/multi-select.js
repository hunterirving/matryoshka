// Multi-select: state management and bulk operations

function clearMultiSelect() {
	state.multiSelectAnchorId = null;
	state.multiSelectedIds = [];
	state.multiCaretOffsets = {};
	state.multiSelectRanges = {};
	state.multiUndoStack = [];
	state.multiRedoStack = [];
	updateMultiRangeStyles();
	document.querySelectorAll('.sim-caret').forEach(el => el.remove());
	var focused = document.activeElement;
	var focusedContainer = focused ? focused.closest('.task-container') : null;
	document.querySelectorAll('.task-container.active').forEach(el => {
		if (el !== focusedContainer) el.classList.remove('active');
	});
}

function getMultiSelectedTasks() {
	return state.currentTask.subtasks.filter(t => state.multiSelectedIds.includes(t.id));
}

// id of the currently-focused selected task, or anchor if focus isn't on one;
// extendMultiSelect needs focus on the selection's moving edge after a move
function getFocusedSelectedId() {
	var container = document.activeElement ? document.activeElement.closest('.task-container') : null;
	var id = container ? container.getAttribute('data-id') : null;
	return state.multiSelectedIds.includes(id) ? id : state.multiSelectAnchorId;
}

function applyMultiSelectHighlights() {
	for (var id of state.multiSelectedIds) {
		var container = document.querySelector(`.task-container[data-id="${id}"]`);
		if (container) container.classList.add('active');
	}
	renderSimCarets();
}

function clampCaret(text, offset) {
	if (typeof offset !== 'number') return text.length;
	return Math.max(0, Math.min(offset, text.length));
}

function syncMultiTaskText(t) {
	var inp = document.querySelector(`.task-container[data-id="${t.id}"] .task-text`);
	if (inp) inp.textContent = t.text;
}

// a line's pending edit target: its stored selection range if it has one
// (clamped to the current text), else null
function getMultiRange(t) {
	var range = state.multiSelectRanges[t.id];
	if (!range) return null;
	var start = Math.min(range.start, t.text.length);
	var end = Math.min(range.end, t.text.length);
	return end > start ? { start: start, end: end } : null;
}

// plain Left/Right during multi-select: step every non-focused line's caret
// (the focused line is handled natively or by the caller)
function stepMultiCarets(key) {
	var focusedContainer = document.activeElement ? document.activeElement.closest('.task-container') : null;
	var focusedId = focusedContainer ? focusedContainer.dataset.id : null;
	for (var t of getMultiSelectedTasks()) {
		if (t.id === focusedId) continue;
		var range = getMultiRange(t);
		if (range) {
			// arrows collapse a selection to its start or end, like native
			state.multiCaretOffsets[t.id] = key === 'ArrowLeft' ? range.start : range.end;
			delete state.multiSelectRanges[t.id];
		} else {
			var off = clampCaret(t.text, state.multiCaretOffsets[t.id]);
			state.multiCaretOffsets[t.id] = key === 'ArrowLeft'
				? prevGraphemeBoundary(t.text, off)
				: nextGraphemeBoundary(t.text, off);
		}
	}
	renderSimCarets();
}

function insertAtMultiCaret(t, str) {
	var range = getMultiRange(t);
	var start = range ? range.start : clampCaret(t.text, state.multiCaretOffsets[t.id]);
	var end = range ? range.end : start;
	t.text = t.text.slice(0, start) + str + t.text.slice(end);
	state.multiCaretOffsets[t.id] = start + str.length;
	delete state.multiSelectRanges[t.id];
	syncMultiTaskText(t);
}

function deleteAtMultiCaret(t, direction) {
	var range = getMultiRange(t);
	var start, end;
	if (range) {
		start = range.start;
		end = range.end;
	} else {
		var off = clampCaret(t.text, state.multiCaretOffsets[t.id]);
		if (direction === 'forward') {
			start = off;
			end = nextGraphemeBoundary(t.text, off);
		} else {
			start = prevGraphemeBoundary(t.text, off);
			end = off;
		}
	}
	if (start < end) {
		t.text = t.text.slice(0, start) + t.text.slice(end);
	}
	state.multiCaretOffsets[t.id] = start;
	delete state.multiSelectRanges[t.id];
	syncMultiTaskText(t);
}

// Backspace/Delete during multi-select: simulate deletion on every selected
// line (including the focused one) so native deletion can't split a grapheme
function deleteAcrossMultiSelection(focusedTask, taskInput, direction) {
	pushMultiUndo();
	var focusedOffset = getCaretOffset(taskInput);
	if (focusedOffset != null) state.multiCaretOffsets[focusedTask.id] = focusedOffset;
	for (var t of getMultiSelectedTasks()) {
		deleteAtMultiCaret(t, direction);
	}
	// rewriting textContent collapses the (hidden) native caret; restore it
	setCaretOffset(taskInput, clampCaret(focusedTask.text, state.multiCaretOffsets[focusedTask.id]));
	renderSimCarets();
	scheduleSave();
}

// Up/Down: leave multi-select onto the task just above/below the chunk
function exitMultiSelect(direction) {
	var selected = getMultiSelectedTasks();
	clearMultiSelect();
	if (selected.length === 0) return;
	var subtasks = state.currentTask.subtasks;
	var indices = selected.map(t => subtasks.findIndex(s => s.id === t.id)).sort((a, b) => a - b);
	if (direction === 'up') {
		// above the first subtask sits the parent task
		selectAndFocusTask(subtasks[indices[0] - 1] || state.currentTask);
	} else {
		selectAndFocusTask(subtasks[Math.min(indices[indices.length - 1] + 1, subtasks.length - 1)]);
	}
}

// Cmd+Z / Cmd+Shift+Z: per-session undo/redo of multi-line edits; snapshots
// are pushed before each mutation (focusedOldText covers input events, where
// the focused line has already changed)
function captureMultiSnapshot(focusedId, focusedOldText) {
	var texts = {};
	for (var t of getMultiSelectedTasks()) {
		texts[t.id] = t.id === focusedId ? focusedOldText : t.text;
	}
	return {
		texts: texts,
		offsets: Object.assign({}, state.multiCaretOffsets),
		ranges: Object.assign({}, state.multiSelectRanges)
	};
}

function pushMultiUndo(focusedId, focusedOldText) {
	state.multiUndoStack.push(captureMultiSnapshot(focusedId, focusedOldText));
	state.multiRedoStack = [];
}

function undoMultiEdit(focusedTask) {
	var entry = state.multiUndoStack.pop();
	if (!entry) return;
	state.multiRedoStack.push(captureMultiSnapshot());
	applyMultiSnapshot(entry, focusedTask);
}

function redoMultiEdit(focusedTask) {
	var entry = state.multiRedoStack.pop();
	if (!entry) return;
	state.multiUndoStack.push(captureMultiSnapshot());
	applyMultiSnapshot(entry, focusedTask);
}

function applyMultiSnapshot(entry, focusedTask) {
	for (var t of getMultiSelectedTasks()) {
		if (typeof entry.texts[t.id] === 'string') {
			t.text = entry.texts[t.id];
			syncMultiTaskText(t);
		}
	}
	state.multiCaretOffsets = entry.offsets;
	state.multiSelectRanges = entry.ranges || {};
	var input = document.querySelector(`.task-container[data-id="${focusedTask.id}"] .task-text`);
	if (input) setCaretOffset(input, clampCaret(focusedTask.text, state.multiCaretOffsets[focusedTask.id]));
	renderSimCarets();
	scheduleSave();
}

// Cmd+A: native select-all on the focused line plus stored full-line ranges
// on the others; the next edit then replaces each line's selection
function selectAllMultiSelected(focusedTask) {
	for (var t of getMultiSelectedTasks()) {
		state.multiSelectRanges[t.id] = { start: 0, end: t.text.length };
		state.multiCaretOffsets[t.id] = t.text.length;
	}
	var input = document.querySelector(`.task-container[data-id="${focusedTask.id}"] .task-text`);
	if (input) selectAllText(input);
	renderSimCarets();
}

// only one real DOM selection can exist, so non-focused lines paint their
// stored ranges with an overlay: a clipped duplicate of the line's text in
// the theme's ::selection colors, glyph-aligned with the original
function updateMultiRangeStyles() {
	document.querySelectorAll('.pseudo-selection').forEach(el => el.remove());
	if (state.multiSelectedIds.length <= 1) return;
	var focusedContainer = document.activeElement ? document.activeElement.closest('.task-container') : null;
	var focusedId = focusedContainer ? focusedContainer.dataset.id : null;
	for (var t of getMultiSelectedTasks()) {
		if (t.id === focusedId) continue;
		var range = getMultiRange(t);
		if (!range) continue;
		var container = document.querySelector(`.task-container[data-id="${t.id}"]`);
		var input = container ? container.querySelector('.task-text') : null;
		var node = input ? input.firstChild : null;
		if (!node || node.nodeType !== Node.TEXT_NODE) continue;
		var r = document.createRange();
		r.setStart(node, Math.min(range.start, node.textContent.length));
		r.setEnd(node, Math.min(range.end, node.textContent.length));
		var rect = r.getBoundingClientRect();
		var inputRect = input.getBoundingClientRect();
		var containerRect = container.getBoundingClientRect();
		var scale = container.offsetWidth ? containerRect.width / container.offsetWidth : 1;
		// clamp to the line's visible text box
		var left = Math.max(rect.left, inputRect.left);
		var right = Math.min(rect.right, inputRect.right);
		if (right <= left || rect.height <= 0) continue;

		var overlay = document.createElement('div');
		overlay.className = 'pseudo-selection';
		var inner = document.createElement('span');
		inner.textContent = t.text;
		overlay.appendChild(inner);

		// match the line's text rendering so the duplicate glyphs coincide;
		// styled on the overlay (not the span) so its line-box strut shares
		// the font metrics, else baseline alignment shifts the span down.
		// text-shadow stays in CSS: themes restyle it under ::selection, and
		// an inline copy of the row's shadow couldn't be overridden there
		var cs = getComputedStyle(input);
		overlay.style.fontFamily = cs.fontFamily;
		overlay.style.fontSize = cs.fontSize;
		overlay.style.fontWeight = cs.fontWeight;
		overlay.style.letterSpacing = cs.letterSpacing;

		overlay.style.left = ((left - containerRect.left) / scale) + 'px';
		overlay.style.top = ((rect.top - containerRect.top) / scale) + 'px';
		overlay.style.width = ((right - left) / scale) + 'px';
		overlay.style.height = (rect.height / scale) + 'px';
		// shift the duplicate so the selected substring lands in the window
		inner.style.marginLeft = (-((left - inputRect.left) / scale + input.scrollLeft)) + 'px';
		container.appendChild(overlay);

		// some fonts' selection rects sit off their line box by ~1px, which
		// would drift the duplicate; measure against the original and cancel
		var probe = document.createRange();
		probe.setStart(inner.firstChild, Math.min(range.start, t.text.length));
		probe.setEnd(inner.firstChild, Math.min(range.end, t.text.length));
		var drift = probe.getBoundingClientRect().top - rect.top;
		if (drift) {
			inner.style.position = 'relative';
			inner.style.top = (-drift / scale) + 'px';
		}
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
		var anchorInput = document.querySelector(`.task-container[data-id="${task.id}"] .task-text`);
		var anchorOffset = anchorInput ? getCaretOffset(anchorInput) : null;
		state.multiCaretOffsets[task.id] = anchorOffset != null ? anchorOffset : task.text.length;
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
			delete state.multiCaretOffsets[task.id];
			delete state.multiSelectRanges[task.id];
			var nextTask = tasks[currentIndex + 1];
			if (nextTask) selectAndFocusTask(nextTask);
		} else if (bottomIndex < tasks.length - 1) {
			var nextTask = tasks[bottomIndex + 1];
			state.multiSelectedIds.push(nextTask.id);
			state.multiCaretOffsets[nextTask.id] = nextTask.text.length;
			delete state.multiSelectRanges[nextTask.id];
			selectAndFocusTask(nextTask);
		}
	} else {
		var topIndex = tasks.findIndex(t => state.multiSelectedIds.includes(t.id));
		if (currentIndex >= anchorIndex && state.multiSelectedIds.length > 1) {
			state.multiSelectedIds = state.multiSelectedIds.filter(id => id !== task.id);
			delete state.multiCaretOffsets[task.id];
			delete state.multiSelectRanges[task.id];
			var prevTask = tasks[currentIndex - 1];
			if (prevTask) selectAndFocusTask(prevTask);
		} else if (topIndex > 0) {
			var prevTask = tasks[topIndex - 1];
			state.multiSelectedIds.unshift(prevTask.id);
			state.multiCaretOffsets[prevTask.id] = prevTask.text.length;
			delete state.multiSelectRanges[prevTask.id];
			selectAndFocusTask(prevTask);
		}
	}

	applyMultiSelectHighlights();
}

function moveMultiSelected(direction) {
	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return false;

	// keep focus on the edge that was focused, so a follow-up extend/contract still works
	var refocusId = getFocusedSelectedId();

	var subtasks = state.currentTask.subtasks;
	var indices = selected.map(t => subtasks.findIndex(s => s.id === t.id)).sort((a, b) => a - b);
	var topIndex = indices[0];
	var bottomIndex = indices[indices.length - 1];

	if (direction === 'up' && topIndex <= 0) return false;
	if (direction === 'down' && bottomIndex >= subtasks.length - 1) return false;

	var chunk = subtasks.splice(topIndex, selected.length);
	var insertAt = direction === 'up' ? topIndex - 1 : topIndex + 1;
	subtasks.splice(insertAt, 0, ...chunk);

	state.currentTask.selectedSubtaskId = refocusId;
	var savedSelection = captureActiveSelection();
	renderCurrentView();
	applyMultiSelectHighlights();
	restoreActiveSelection(savedSelection);
	scheduleSave();
	return true;
}

function pushMultiSelectedIntoTarget(direction, navigate = false) {
	var selected = getMultiSelectedTasks();
	if (selected.length === 0) return false;

	var refocusId = getFocusedSelectedId();

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
	targetTask.selectedSubtaskId = refocusId;
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

	var refocusId = getFocusedSelectedId();

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
		state.currentTask.selectedSubtaskId = refocusId;
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
