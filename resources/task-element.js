// Task element: DOM creation and per-element event handlers

// grapheme-aware caret stepping so surrogate pairs / ZWJ emoji never split
function prevGraphemeBoundary(text, offset) {
	if (offset <= 0) return 0;
	if (typeof Intl !== 'undefined' && Intl.Segmenter) {
		var prev = 0;
		for (var seg of new Intl.Segmenter().segment(text)) {
			if (seg.index >= offset) break;
			prev = seg.index;
		}
		return prev;
	}
	// fallback: step one code point
	var cut = offset - 1;
	if (cut > 0 && text.charCodeAt(cut) >= 0xDC00 && text.charCodeAt(cut) <= 0xDFFF) cut--;
	return cut;
}

function nextGraphemeBoundary(text, offset) {
	if (offset >= text.length) return text.length;
	if (typeof Intl !== 'undefined' && Intl.Segmenter) {
		for (var seg of new Intl.Segmenter().segment(text)) {
			var end = seg.index + seg.segment.length;
			if (end > offset) return end;
		}
		return text.length;
	}
	var next = offset + 1;
	if (next < text.length && text.charCodeAt(offset) >= 0xD800 && text.charCodeAt(offset) <= 0xDBFF) next++;
	return next;
}

// native deletion splits ZWJ emoji in firefox; when the grapheme next to the
// caret spans multiple code units, delete it whole and report handled
function deleteWholeGrapheme(taskInput, direction) {
	var sel = window.getSelection();
	var off = getCaretOffset(taskInput);
	if (!sel || !sel.isCollapsed || off == null) return false;
	var text = taskInput.textContent;
	var start = direction === 'backward' ? prevGraphemeBoundary(text, off) : off;
	var end = direction === 'backward' ? off : nextGraphemeBoundary(text, off);
	if (end - start <= 1) return false;
	taskInput.textContent = text.slice(0, start) + text.slice(end);
	setCaretOffset(taskInput, start);
	// synthetic input event so the regular listener syncs task.text and saves
	taskInput.dispatchEvent(new InputEvent('input', {
		inputType: direction === 'backward' ? 'deleteContentBackward' : 'deleteContentForward',
		bubbles: true
	}));
	return true;
}

function createTaskElement(task, isParentTask = false) {
	var taskContainer = document.createElement('div');
	taskContainer.className = 'task-container';
	taskContainer.dataset.id = task.id;
	if (isParentTask) taskContainer.classList.add('parent-task');

	var checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.className = 'custom-checkbox';
	checkbox.id = `checkbox-${task.id}`;
	updateCheckboxState(checkbox, task.state);
	checkbox.addEventListener('click', (e) => {
		e.preventDefault();
		toggleTaskState(task);
	});

	var checkboxLabel = document.createElement('label');
	checkboxLabel.className = 'checkbox-label';
	checkboxLabel.setAttribute('for', `checkbox-${task.id}`);

	var taskInput = document.createElement('div');
	taskInput.className = 'task-text';
	taskInput.contentEditable = 'plaintext-only';
	taskInput.textContent = task.text;
	taskInput.setAttribute('spellcheck', 'false');
	taskInput.setAttribute('autocorrect', 'off');
	taskInput.setAttribute('autocapitalize', 'off');

	taskInput.addEventListener('mousedown', function(e) {
		e.stopPropagation();
	});

	var keydownHandler = function(e) {
		if (e.key === 'Backspace') {
			if (keyHandler.backspace.blocked) {
				e.preventDefault();
				return;
			}
			// Multi-select backspace handling
			if (state.multiSelectedIds.length > 1) {
				var selected = getMultiSelectedTasks();
				var allEmpty = selected.every(t => t.text === '');
				if (allEmpty) {
					e.preventDefault();
					if (keyHandler.backspace.canDelete) {
						keyHandler.backspace.blocked = true;
						var toDelete = selected.filter(t => t !== state.taskPath[0] && t !== state.currentTask);
						if (toDelete.length > 0 && !(state.currentTask.id === 'root' && toDelete.length >= state.currentTask.subtasks.length)) {
							var firstDeleteIdx = Math.min(...toDelete.map(t => state.currentTask.subtasks.findIndex(s => s.id === t.id)).filter(i => i !== -1));
							for (var t of toDelete) {
								var idx = state.currentTask.subtasks.findIndex(s => s.id === t.id);
								if (idx !== -1) state.currentTask.subtasks.splice(idx, 1);
							}
							clearMultiSelect();
							updateTaskAndAncestors(state.currentTask);
							if (state.currentTask.subtasks.length === 0 && state.taskPath.length > 1) {
								navigateToParentTask();
							} else {
								renderCurrentView();
								var targetIndex = Math.max(0, firstDeleteIdx - 1);
								selectAndFocusTask(state.currentTask.subtasks[targetIndex]);
							}
							scheduleSave();
						} else {
							for (var t of selected) {
								applyShakeAnimation(t.id);
							}
						}
					}
					return;
				}
				// Some tasks still have text: delete each line's selection,
				// or the grapheme before its caret
				e.preventDefault();
				deleteAcrossMultiSelection(task, taskInput, 'backward');
				keyHandler.backspace.canDelete = false;
				return;
			}
			if (taskInput.textContent === '' && keyHandler.backspace.canDelete && state.multiSelectedIds.length <= 1) {
				e.preventDefault();
				if (task !== state.taskPath[0]) {
					keyHandler.backspace.blocked = true;
					clearMultiSelect();
					if (task === state.currentTask) {
						deleteCurrentParentTask();
					} else {
						deleteSubtask(task);
					}
				} else {
					applyShakeAnimation(task.id);
				}
			} else if (taskInput.textContent !== '') {
				keyHandler.backspace.canDelete = false;
				if (deleteWholeGrapheme(taskInput, 'backward')) e.preventDefault();
			}
		} else if (e.key === 'Delete') {
			if (state.multiSelectedIds.length > 1) {
				e.preventDefault();
				deleteAcrossMultiSelection(task, taskInput, 'forward');
			} else if (deleteWholeGrapheme(taskInput, 'forward')) {
				e.preventDefault();
			} else {
				handleKeyDown(e, task);
			}
		} else if (e.key === 'Enter' && !e.shiftKey) {
			if (keyHandler.enter.blocked) {
				e.preventDefault();
				return;
			}
			if (keyHandler.enter.canAdd) {
				e.preventDefault();
				keyHandler.enter.blocked = true;
				clearMultiSelect();
				addNewSubtask(state.currentTask, task);
			}
		} else if (e.key === 'ArrowDown' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
			if (keyHandler.arrowDown.blocked) {
				e.preventDefault();
				return;
			}
			// during multi-select, "at the bottom" means the chunk's bottom line
			var bottomTask = state.multiSelectedIds.length > 1
				? getMultiSelectedTasks().slice(-1)[0] || task
				: task;
			if (isLastSubtask(bottomTask) && state.lastSubtaskDownArrowReleased && bottomTask !== state.currentTask) {
				e.preventDefault();
				keyHandler.arrowDown.blocked = true;
				clearMultiSelect();
				addNewSubtask(state.currentTask, bottomTask);
				state.lastSubtaskDownArrowReleased = false;
			} else {
				handleKeyDown(e, task);
			}
		} else if (e.key === 'ArrowDown' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
			if (keyHandler.shiftArrowDown.blocked) {
				e.preventDefault();
				return;
			}
			// Multi-select: insert new task above chunk when at bottom
			if (state.multiSelectedIds.length > 1 && !e.repeat) {
				var selected = getMultiSelectedTasks();
				var lastSelected = selected[selected.length - 1];
				if (isLastSubtask(lastSelected) && state.lastSubtaskShiftDownReleased) {
					e.preventDefault();
					keyHandler.shiftArrowDown.blocked = true;
					var topIndex = state.currentTask.subtasks.findIndex(t => state.multiSelectedIds.includes(t.id));
					var newSubtask = { id: generateId(), text: '', state: 0, subtasks: [], selectedSubtaskId: null };
					state.currentTask.subtasks.splice(topIndex, 0, newSubtask);
					updateTaskAndAncestors(state.currentTask);
					state.currentTask.selectedSubtaskId = state.multiSelectAnchorId;
					renderCurrentView();
					applyMultiSelectHighlights();
					scheduleSave();
					state.lastSubtaskShiftDownReleased = false;
				} else {
					handleKeyDown(e, task);
				}
			} else if (isLastSubtask(task) && state.lastSubtaskShiftDownReleased && task !== state.currentTask && !e.repeat) {
				e.preventDefault();
				keyHandler.shiftArrowDown.blocked = true;
				var parentTask = findParentTask(task);
				if (parentTask) {
					var index = parentTask.subtasks.findIndex(t => t.id === task.id);
					var newSubtask = { id: generateId(), text: '', state: 0, subtasks: [], selectedSubtaskId: null };
					parentTask.subtasks.splice(index, 0, newSubtask);
					updateTaskAndAncestors(parentTask);
					renderCurrentView();
					selectAndFocusTask(task);
					scheduleSave();
				}
				state.lastSubtaskShiftDownReleased = false;
			} else {
				handleKeyDown(e, task);
			}
		} else {
			handleKeyDown(e, task);
		}
	};

	var keyupHandler = function(e) {
		if (e.key === 'Backspace') {
			keyHandler.backspace.canDelete = true;
			keyHandler.backspace.blocked = false;
		} else if (e.key === 'Enter') {
			keyHandler.enter.canAdd = true;
			keyHandler.enter.blocked = false;
			keyHandler.shiftEnter.pressed = false;
		} else if (e.key === 'ArrowDown') {
			keyHandler.arrowDown.canAdd = true;
			keyHandler.arrowDown.blocked = false;
			keyHandler.shiftArrowDown.blocked = false;
			var isAtBottom = state.multiSelectedIds.length > 1
				? isLastSubtask(getMultiSelectedTasks().slice(-1)[0])
				: isLastSubtask(task);
			if (isAtBottom) {
				state.lastSubtaskDownArrowReleased = true;
				state.lastSubtaskShiftDownReleased = true;
			} else {
				state.lastSubtaskDownArrowReleased = false;
				state.lastSubtaskShiftDownReleased = false;
			}
		} else if (e.key === 'ArrowRight') {
			keyHandler.shiftRight.pressed = false;
		} else if (e.key === 'ArrowLeft') {
			keyHandler.shiftLeft.pressed = false;
		}
	};

	taskInput.addEventListener('keydown', keydownHandler);
	taskInput.addEventListener('keyup', keyupHandler);
	taskInput.addEventListener('keydown', handleCopyAndCut);
	taskInput.addEventListener('input', (e) => {
		var oldText = task.text;
		// Normalize: strip newlines a paste/IME may introduce, and convert
		// contenteditable's nbsp space substitutions back to plain spaces
		var normalized = taskInput.textContent.replace(/\n/g, '').replace(/\u00A0/g, ' ');
		if (normalized !== taskInput.textContent) {
			var caret = getCaretOffset(taskInput);
			taskInput.textContent = normalized;
			if (caret != null) setCaretOffset(taskInput, caret);
		}
		task.text = taskInput.textContent;
		// Propagate edits to all other multi-selected tasks
		if (state.multiSelectedIds.length > 1 && state.multiSelectedIds.includes(task.id)) {
			// snapshot before mirroring; the focused line already changed, so
			// its pre-edit text comes from oldText
			pushMultiUndo(task.id, oldText);
			var focusedOffset = getCaretOffset(taskInput);
			if (focusedOffset != null) state.multiCaretOffsets[task.id] = focusedOffset;
			var otherSelected = getMultiSelectedTasks().filter(t => t.id !== task.id);

			if (e.inputType === 'insertText' && e.data) {
				var data = e.data.replace(/\u00A0/g, ' ');
				for (var t of otherSelected) {
					insertAtMultiCaret(t, data);
				}
			} else if (e.inputType === 'deleteContentBackward') {
				for (var t of otherSelected) {
					deleteAtMultiCaret(t, 'backward');
				}
			} else if (e.inputType === 'deleteContentForward') {
				for (var t of otherSelected) {
					deleteAtMultiCaret(t, 'forward');
				}
			} else if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
				// the paste may have replaced the focused line's selection, so
				// account for the replaced range when sizing the pasted text
				var preRange = state.multiSelectRanges[task.id];
				var replacedLen = preRange
					? Math.min(preRange.end, oldText.length) - Math.min(preRange.start, oldText.length)
					: 0;
				var addedLen = taskInput.textContent.length - oldText.length + Math.max(0, replacedLen);
				if (addedLen > 0) {
					var caretPos = getCaretOffset(taskInput);
					var pastedText = taskInput.textContent.slice(caretPos - addedLen, caretPos);
					for (var t of otherSelected) {
						insertAtMultiCaret(t, pastedText);
					}
				}
			}
			// the edit consumed the focused line's selection
			delete state.multiSelectRanges[task.id];
			renderSimCarets();
		}
		if (task === state.currentTask) {
			updatePageTitle(task);
		}
		scheduleSave();
	});

	taskInput.addEventListener('focus', () => {
		if (state.multiSelectedIds.length > 1 && !state.multiSelectedIds.includes(task.id)) {
			clearMultiSelect();
		}
		setActiveTask(taskInput, task);
	});

	taskContainer.appendChild(checkbox);
	taskContainer.appendChild(checkboxLabel);
	taskContainer.appendChild(taskInput);

	return taskContainer;
}
