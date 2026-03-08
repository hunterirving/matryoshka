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
	// Plain Up/Down: navigate (clears multi-select)
	} else if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) clearMultiSelect();
		navigateTasks('up');
	} else if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (hasMultiSelect) clearMultiSelect();
		navigateTasks('down');
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
	}
}
