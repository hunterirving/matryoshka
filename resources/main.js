// Main: initialization and global event listeners

document.addEventListener('click', function(e) {
	if (!e.target.closest('.task-container')) {
		var activeTask = document.querySelector('.task-container.active');
		if (activeTask) {
			var taskInput = activeTask.querySelector('.task-text');
			taskInput.focus();
		} else {
			selectFirstSubtask();
		}
	}
});

document.addEventListener('DOMContentLoaded', function() {
	state.appContainer = document.getElementById('app-container');
	state.rootTask = loadTasksFromLocalStorage();
	state.currentTask = state.rootTask;
	state.taskPath = [state.currentTask];

	// Scroll handler to block default scroll behavior
	function handleScroll(e) {
		e.preventDefault();
	}
	window.addEventListener('wheel', handleScroll, { passive: false });

	// Print handlers
	function handleBeforePrint() {
		var printContent = document.getElementById('print-content');
		if (!printContent) {
			printContent = document.createElement('div');
			printContent.id = 'print-content';
			document.body.appendChild(printContent);
		}
		var serializedTasks = serializeTaskTree(state.currentTask);
		printContent.textContent = serializedTasks;
	}

	function handleAfterPrint() {
		var printContent = document.getElementById('print-content');
		if (printContent) {
			printContent.remove();
		}
	}

	window.addEventListener('beforeprint', handleBeforePrint);
	window.addEventListener('afterprint', handleAfterPrint);

	// Theme cycling with F2
	document.addEventListener('keydown', function(event) {
		if (event.key === 'F2' && !state.isF2Pressed) {
			event.preventDefault();
			state.isF2Pressed = true;
			cycleTheme();
		}
	});

	document.addEventListener('keyup', function(event) {
		if (event.key === 'F2') {
			state.isF2Pressed = false;
		}
	});

	// File save/open handlers
	document.addEventListener('keydown', handleSave);
	document.addEventListener('keydown', handleOpen);

	// Reset cursor on non-focused task-text elements
	state.appContainer.addEventListener('focusin', function(e) {
		if (e.target.classList && e.target.classList.contains('task-text')) {
			document.querySelectorAll('.task-text').forEach(input => {
				if (input === e.target) return;
				// multi-selected lines keep their own caret scrolled into view
				if (state.multiSelectedIds.length > 1) {
					var container = input.closest('.task-container');
					if (container && state.multiSelectedIds.includes(container.dataset.id)) return;
				}
				placeCursorAtBeginning(input);
			});
		}
	});

	// The native caret is hidden app-wide; mirror the focused line's caret
	// position and redraw the simulated carets on every selection change
	document.addEventListener('selectionchange', function() {
		var el = document.activeElement;
		if (!el || !el.classList || !el.classList.contains('task-text')) return;
		if (state.multiSelectedIds.length > 1) {
			var container = el.closest('.task-container');
			var id = container ? container.dataset.id : null;
			var sel = window.getSelection();
			if (id && state.multiSelectedIds.includes(id) && sel && sel.rangeCount > 0) {
				var offset = getCaretOffset(el);
				if (offset != null) {
					// live-track the focused line's selection so it persists as a
					// painted range when focus moves to another line; a collapse
					// (click, arrow) clears it, like native
					var len = sel.isCollapsed ? 0 : sel.toString().length;
					if (len > 0) {
						state.multiSelectRanges[id] = { start: offset - len, end: offset };
					} else {
						delete state.multiSelectRanges[id];
					}
					state.multiCaretOffsets[id] = offset;
				}
			}
		}
		renderSimCarets();
	});

	// hide simulated carets while the window is inactive, like native ones
	state.windowFocused = document.hasFocus();
	window.addEventListener('focus', function() {
		state.windowFocused = true;
		renderSimCarets();
	});
	window.addEventListener('blur', function() {
		state.windowFocused = false;
		renderSimCarets();
	});

	// drop the caret if focus leaves the task texts entirely
	state.appContainer.addEventListener('focusout', function() {
		requestAnimationFrame(renderSimCarets);
	});

	// Initialize
	setInitialTheme();
	renderCurrentView();
	selectFirstSubtask();

	// re-pin the active caret's scroll once layout settles and once fonts load
	requestAnimationFrame(rescrollActiveCaret);
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(rescrollActiveCaret);
	}
});
