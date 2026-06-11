// Keyboard: key handler state and handleKeyDown dispatch

var keyHandler = {
	backspace: {
		canDelete: true,
		blocked: false
	},
	enter: {
		canAdd: true,
		blocked: false
	},
	arrowDown: {
		canAdd: true,
		blocked: false
	},
	shiftArrowDown: {
		blocked: false
	},
	shiftEnter: {
		pressed: false
	},
	shiftRight: {
		pressed: false
	},
	shiftLeft: {
		pressed: false
	}
};

function handleKeyDown(e, task) {
	var cmd = e.metaKey || e.ctrlKey;
	var hasMultiSelect = state.multiSelectedIds.length > 1;

	// Alt+Up/Down: extend multi-selection
	if (e.key === 'ArrowUp' && e.altKey && !cmd && !e.shiftKey) {
		e.preventDefault();
		extendMultiSelect(task, 'up');
		return;
	} else if (e.key === 'ArrowDown' && e.altKey && !cmd && !e.shiftKey) {
		e.preventDefault();
		extendMultiSelect(task, 'down');
		return;
	}

	// Shift+Enter: toggle task state (bulk if multi-selected)
	if (e.key === 'Enter' && e.shiftKey) {
		e.preventDefault();
		if (!keyHandler.shiftEnter.pressed) {
			keyHandler.shiftEnter.pressed = true;
			if (hasMultiSelect) {
				bulkToggleTaskState();
			} else {
				toggleTaskState(task);
			}
		}
	// Cmd+Up: push into task above
	} else if (e.key === 'ArrowUp' && cmd && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pushMultiSelectedIntoTarget('up') : pushSubtaskIntoTarget(task, 'up');
			if (!success) {
				hasMultiSelect ? shakeAllSelected('vertical') : applyShakeAnimation(task.id, 'vertical');
			}
		}
	// Cmd+Down: push into task below
	} else if (e.key === 'ArrowDown' && cmd && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pushMultiSelectedIntoTarget('down') : pushSubtaskIntoTarget(task, 'down');
			if (!success) {
				hasMultiSelect ? shakeAllSelected('vertical') : applyShakeAnimation(task.id, 'vertical');
			}
		}
	} else if (e.key === 'ArrowRight' && cmd && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		hasMultiSelect ? shakeAllSelected() : applyShakeAnimation(task.id);
	// Cmd+Left: pull out one level
	} else if (e.key === 'ArrowLeft' && cmd && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pullMultiSelectedOutLayer() : pullSubtaskOutLayer(task);
			if (!success) {
				hasMultiSelect ? shakeAllSelected() : applyShakeAnimation(task.id);
			}
		}
	// Cmd+Shift+Up: push and navigate
	} else if (e.key === 'ArrowUp' && cmd && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pushMultiSelectedIntoTarget('up', true) : pushSubtaskIntoTarget(task, 'up', true);
			if (!success) {
				hasMultiSelect ? shakeAllSelected('vertical') : applyShakeAnimation(task.id, 'vertical');
			}
		}
	// Cmd+Shift+Down: push and navigate
	} else if (e.key === 'ArrowDown' && cmd && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pushMultiSelectedIntoTarget('down', true) : pushSubtaskIntoTarget(task, 'down', true);
			if (!success) {
				hasMultiSelect ? shakeAllSelected('vertical') : applyShakeAnimation(task.id, 'vertical');
			}
		}
	// Cmd+Shift+Left: pull and navigate
	} else if (e.key === 'ArrowLeft' && cmd && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (!e.repeat) {
			var success = hasMultiSelect ? pullMultiSelectedOutLayer(true) : pullSubtaskOutLayer(task, true);
			if (!success) {
				hasMultiSelect ? shakeAllSelected() : applyShakeAnimation(task.id);
			}
		}
	} else if (e.key === 'ArrowRight' && cmd && e.shiftKey && !e.altKey) {
		e.preventDefault();
		hasMultiSelect ? shakeAllSelected() : applyShakeAnimation(task.id);
	// Plain Up/Down: navigate (multi-select exits onto the task beyond the chunk)
	} else if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) {
			exitMultiSelect('up');
		} else {
			navigateTasks('up');
		}
	} else if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) {
			exitMultiSelect('down');
		} else {
			navigateTasks('down');
		}
	// Shift+Up/Down: move task
	} else if (e.key === 'ArrowUp' && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) {
			if (!moveMultiSelected('up')) shakeAllSelected('vertical');
		} else {
			if (!moveSubtask(task, 'up')) applyShakeAnimation(task.id, 'vertical');
		}
	} else if (e.key === 'ArrowDown' && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) {
			if (!moveMultiSelected('down')) shakeAllSelected('vertical');
		} else {
			if (!moveSubtask(task, 'down')) applyShakeAnimation(task.id, 'vertical');
		}
	// Shift+Right: navigate into subtask (blocked during multi-select)
	} else if (e.key === 'ArrowRight' && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) {
			if (!keyHandler.shiftRight.pressed) {
				keyHandler.shiftRight.pressed = true;
				shakeAllSelected();
			}
		} else if (!keyHandler.shiftRight.pressed) {
			keyHandler.shiftRight.pressed = true;
			if (task !== state.currentTask) {
				navigateIntoSubtask(task);
			} else {
				applyShakeAnimation(task.id);
			}
		}
	// Shift+Left: navigate to parent
	} else if (e.key === 'ArrowLeft' && e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect && state.currentTask.id === 'root') {
			if (!keyHandler.shiftLeft.pressed) {
				keyHandler.shiftLeft.pressed = true;
				shakeAllSelected();
			}
		} else if (hasMultiSelect) {
			clearMultiSelect();
			if (!keyHandler.shiftLeft.pressed) {
				keyHandler.shiftLeft.pressed = true;
				navigateToParentTask();
			}
		} else if (!keyHandler.shiftLeft.pressed) {
			keyHandler.shiftLeft.pressed = true;
			navigateToParentTask();
		}
	// Plain Left/Right during multi-select: every line's caret steps together
	} else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !e.altKey && hasMultiSelect) {
		// the focused line moves natively; selectionchange syncs its offset
		var focusedContainer = document.activeElement ? document.activeElement.closest('.task-container') : null;
		var focusedId = focusedContainer ? focusedContainer.dataset.id : null;
		for (var t of getMultiSelectedTasks()) {
			if (t.id === focusedId) continue;
			var range = getMultiRange(t);
			if (range) {
				// arrows collapse a selection to its start or end, like native
				state.multiCaretOffsets[t.id] = e.key === 'ArrowLeft' ? range.start : range.end;
				delete state.multiSelectRanges[t.id];
			} else {
				var off = clampCaret(t.text, state.multiCaretOffsets[t.id]);
				state.multiCaretOffsets[t.id] = e.key === 'ArrowLeft'
					? prevGraphemeBoundary(t.text, off)
					: nextGraphemeBoundary(t.text, off);
			}
		}
		renderSimCarets();
	// Cmd+A during multi-select: select all text across all selected lines
	} else if ((e.key === 'a' || e.key === 'A') && cmd && !e.shiftKey && !e.altKey && hasMultiSelect) {
		e.preventDefault();
		selectAllMultiSelected(task);
	// Cmd+Z / Cmd+Shift+Z during multi-select: app-level undo/redo (native
	// history would only touch the focused line, so it's blocked)
	} else if ((e.key === 'z' || e.key === 'Z') && cmd && !e.altKey && hasMultiSelect) {
		e.preventDefault();
		e.shiftKey ? redoMultiEdit(task) : undoMultiEdit(task);
	}
}
