// Task element: DOM creation and per-element event handlers

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

	var taskInput = document.createElement('input');
	taskInput.type = 'text';
	taskInput.value = task.text;
	taskInput.setAttribute('autocomplete', 'off');
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
				// Some tasks still have text: remove last char from all that have text
				e.preventDefault();
				for (var t of selected) {
					if (t.text.length > 0) {
						t.text = t.text.slice(0, -1);
						var inp = document.querySelector(`.task-container[data-id="${t.id}"] input[type="text"]`);
						if (inp) inp.value = t.text;
					}
				}
				keyHandler.backspace.canDelete = false;
				scheduleSave();
				return;
			}
			if (taskInput.value === '' && keyHandler.backspace.canDelete && state.multiSelectedIds.length <= 1) {
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
			} else if (taskInput.value !== '') {
				keyHandler.backspace.canDelete = false;
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
			if (isLastSubtask(task) && state.lastSubtaskDownArrowReleased && task !== state.currentTask) {
				e.preventDefault();
				keyHandler.arrowDown.blocked = true;
				addNewSubtask(state.currentTask, task);
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
		task.text = taskInput.value;
		// Propagate edits to all other multi-selected tasks
		if (state.multiSelectedIds.length > 1 && state.multiSelectedIds.includes(task.id)) {
			var otherSelected = getMultiSelectedTasks().filter(t => t.id !== task.id);

			if (e.inputType === 'insertText' && e.data) {
				for (var t of otherSelected) {
					t.text = t.text + e.data;
					var otherInput = document.querySelector(`.task-container[data-id="${t.id}"] input[type="text"]`);
					if (otherInput) otherInput.value = t.text;
				}
			} else if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
				for (var t of otherSelected) {
					if (t.text.length > 0) {
						t.text = t.text.slice(0, -1);
					}
					var otherInput = document.querySelector(`.task-container[data-id="${t.id}"] input[type="text"]`);
					if (otherInput) otherInput.value = t.text;
				}
			} else if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
				var addedLen = taskInput.value.length - oldText.length;
				if (addedLen > 0) {
					var pastedText = taskInput.value.slice(taskInput.selectionStart - addedLen, taskInput.selectionStart);
					for (var t of otherSelected) {
						t.text = t.text + pastedText;
						var otherInput = document.querySelector(`.task-container[data-id="${t.id}"] input[type="text"]`);
						if (otherInput) otherInput.value = t.text;
					}
				}
			}
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
