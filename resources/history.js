// History: app-wide undo/redo of per-task changes and view moves

var editHistory = {
	undoStack: [],
	redoStack: [],
	committedIndex: null,
	committedView: null,
	treeChanged: false,
	checkPending: false,
	typingTaskId: null,
	lastTypingTime: 0,
	typingPauseMs: 1000,
	maxEdits: 10
};

function createTaskRecord(task) {
	return {
		text: task.text,
		state: task.state,
		selectedSubtaskId: task.selectedSubtaskId || null,
		subtaskIds: task.subtasks.map(t => t.id)
	};
}

function indexTaskTree(root) {
	var index = new Map();
	(function visit(task) {
		index.set(task.id, createTaskRecord(task));
		task.subtasks.forEach(visit);
	})(root);
	return index;
}

function liveTaskMap() {
	var tasks = new Map();
	(function visit(task) {
		tasks.set(task.id, task);
		task.subtasks.forEach(visit);
	})(state.taskPath[0]);
	return tasks;
}

function subtaskIdsMatch(ids, subtasks) {
	if (ids.length !== subtasks.length) return false;
	for (var i = 0; i < ids.length; i++) {
		if (ids[i] !== subtasks[i].id) return false;
	}
	return true;
}

function diffSubtaskIds(oldIds, newIds) {
	var start = 0;
	while (start < oldIds.length && start < newIds.length && oldIds[start] === newIds[start]) start++;
	var oldEnd = oldIds.length;
	var newEnd = newIds.length;
	while (oldEnd > start && newEnd > start && oldIds[oldEnd - 1] === newIds[newEnd - 1]) {
		oldEnd--;
		newEnd--;
	}
	return {
		before: { start: start, ids: oldIds.slice(start, oldEnd) },
		after: { start: start, ids: newIds.slice(start, newEnd) }
	};
}

function diffTaskRecords(old, record) {
	var before = {};
	var after = {};
	for (var field of ['text', 'state', 'selectedSubtaskId']) {
		if (old[field] !== record[field]) {
			before[field] = old[field];
			after[field] = record[field];
		}
	}
	if (old.subtaskIds !== record.subtaskIds) {
		var splice = diffSubtaskIds(old.subtaskIds, record.subtaskIds);
		before.subtaskSplice = splice.before;
		after.subtaskSplice = splice.after;
	}
	return { before: before, after: after };
}

function collectTreeChanges() {
	var index = editHistory.committedIndex;
	var changes = [];
	var created = [];
	var visitedExisting = 0;
	(function visit(task) {
		var old = index.get(task.id);
		if (!old) {
			var record = createTaskRecord(task);
			created.push([task.id, record]);
			changes.push({ id: task.id, before: null, after: record });
		} else {
			visitedExisting++;
			var sameSubtasks = subtaskIdsMatch(old.subtaskIds, task.subtasks);
			if (old.text !== task.text || old.state !== task.state
				|| old.selectedSubtaskId !== (task.selectedSubtaskId || null) || !sameSubtasks) {
				var record = createTaskRecord(task);
				if (sameSubtasks) record.subtaskIds = old.subtaskIds;
				var diff = diffTaskRecords(old, record);
				changes.push({ id: task.id, before: diff.before, after: diff.after });
				index.set(task.id, record);
			}
		}
		task.subtasks.forEach(visit);
	})(state.taskPath[0]);

	if (visitedExisting < index.size) {
		var live = liveTaskMap();
		index.forEach((record, id) => {
			if (!live.has(id)) changes.push({ id: id, before: record, after: null });
		});
		for (var change of changes) {
			if (change.after === null) index.delete(change.id);
		}
	}
	for (var entry of created) {
		index.set(entry[0], entry[1]);
	}
	return changes;
}

function applyTaskChanges(changes, side) {
	var tasks = liveTaskMap();
	var linking = [];
	for (var change of changes) {
		var record = change[side];
		var otherRecord = side === 'before' ? change.after : change.before;
		if (record === null) {
			tasks.delete(change.id);
			continue;
		}
		if (otherRecord === null) {
			tasks.set(change.id, { id: change.id, subtasks: [] });
		}
		var task = tasks.get(change.id);
		if ('text' in record) task.text = record.text;
		if ('state' in record) task.state = record.state;
		if ('selectedSubtaskId' in record) task.selectedSubtaskId = record.selectedSubtaskId;
		if ('subtaskIds' in record || 'subtaskSplice' in record) {
			linking.push({ task: task, record: record, otherRecord: otherRecord });
		}
	}
	for (var link of linking) {
		if ('subtaskIds' in link.record) {
			link.task.subtasks = link.record.subtaskIds.map(id => tasks.get(id));
		} else {
			var splice = link.record.subtaskSplice;
			var removedCount = link.otherRecord.subtaskSplice.ids.length;
			link.task.subtasks.splice(splice.start, removedCount, ...splice.ids.map(id => tasks.get(id)));
		}
	}
	return tasks;
}

function captureView() {
	var el = document.activeElement;
	if (!el || !el.classList || !el.classList.contains('task-text')) return null;
	return {
		pathIds: state.taskPath.map(t => t.id),
		focusedId: el.closest('.task-container').dataset.id,
		caret: getCaretOffset(el),
		multi: state.multiSelectedIds.length > 1 ? {
			anchorId: state.multiSelectAnchorId,
			ids: state.multiSelectedIds.slice(),
			offsets: Object.assign({}, state.multiCaretOffsets),
			ranges: JSON.parse(JSON.stringify(state.multiSelectRanges))
		} : null
	};
}

function viewLocation(view) {
	return view.pathIds.join('/') + '|' + view.focusedId + '|' + (view.multi ? view.multi.ids.join(',') : '');
}

function isSelectionOnlyChange(change) {
	return change.before !== null && change.after !== null
		&& Object.keys(change.after).every(field => field === 'selectedSubtaskId');
}

function isTextOnlyChange(change) {
	return change.before !== null && change.after !== null
		&& Object.keys(change.after).every(field => field === 'text');
}

function trimUndoStack() {
	var edits = editHistory.undoStack.filter(entry => entry.isEdit).length;
	while (edits > editHistory.maxEdits) {
		if (editHistory.undoStack.shift().isEdit) edits--;
	}
}

function initHistory() {
	editHistory.committedIndex = indexTaskTree(state.taskPath[0]);
	editHistory.committedView = captureView();
}

function scheduleHistoryCheck() {
	editHistory.treeChanged = true;
	scheduleViewCheck();
}

function scheduleViewCheck() {
	if (editHistory.checkPending) return;
	editHistory.checkPending = true;
	queueMicrotask(checkHistory);
}

function checkHistory() {
	editHistory.checkPending = false;
	if (!editHistory.committedIndex) return;
	var view = captureView() || editHistory.committedView;
	var moved = viewLocation(view) !== viewLocation(editHistory.committedView);
	if (!editHistory.treeChanged && !moved) {
		editHistory.committedView = view;
		return;
	}
	editHistory.treeChanged = false;
	var changes = collectTreeChanges();
	if (changes.length === 0 && !moved) {
		editHistory.committedView = view;
		return;
	}

	var now = Date.now();
	var isTyping = !moved && changes.every(isTextOnlyChange);
	var continuesTyping = isTyping
		&& view.focusedId === editHistory.typingTaskId
		&& now - editHistory.lastTypingTime < editHistory.typingPauseMs;
	if (continuesTyping) {
		mergeTypingChanges(editHistory.undoStack[editHistory.undoStack.length - 1], changes, view);
	} else {
		editHistory.undoStack.push({
			changes: changes,
			before: editHistory.committedView,
			after: view,
			isEdit: !changes.every(isSelectionOnlyChange)
		});
		trimUndoStack();
		editHistory.redoStack = [];
	}
	editHistory.typingTaskId = isTyping ? view.focusedId : null;
	editHistory.lastTypingTime = now;
	editHistory.committedView = view;
}

function mergeTypingChanges(entry, changes, view) {
	for (var change of changes) {
		var existing = entry.changes.find(c => c.id === change.id);
		if (existing) {
			existing.after.text = change.after.text;
		} else {
			entry.changes.push(change);
		}
	}
	entry.after = view;
}

function undoHistory(task) {
	stepHistory(editHistory.undoStack, editHistory.redoStack, 'before', task);
}

function redoHistory(task) {
	stepHistory(editHistory.redoStack, editHistory.undoStack, 'after', task);
}

function stepHistory(fromStack, toStack, side, task) {
	var entry = fromStack.pop();
	if (!entry) {
		state.multiSelectedIds.length > 1 ? shakeAllSelected() : applyShakeAnimation(task.id);
		return;
	}
	toStack.push(entry);
	var sameLevel = entry[side].pathIds.join('/') === state.taskPath.map(t => t.id).join('/');
	var tasks = applyTaskChanges(entry.changes, side);
	restoreView(entry[side], tasks, entry.isEdit || !sameLevel);
	editHistory.typingTaskId = null;
	scheduleSave();
	collectTreeChanges();
	editHistory.treeChanged = false;
	editHistory.committedView = captureView();
}

function restoreView(view, tasks, redraw) {
	clearMultiSelect();
	state.taskPath = view.pathIds.map(id => tasks.get(id));
	if (view.multi) {
		state.multiSelectAnchorId = view.multi.anchorId;
		state.multiSelectedIds = view.multi.ids.slice();
		state.multiCaretOffsets = Object.assign({}, view.multi.offsets);
		state.multiSelectRanges = JSON.parse(JSON.stringify(view.multi.ranges));
	}
	if (redraw) renderCurrentView();
	selectAndFocusTask(tasks.get(view.focusedId), view.caret);
	if (view.multi) applyMultiSelectHighlights();
}
