// Main: initialization and global event listeners

document.addEventListener('click', function(e) {
	if (!e.target.closest('.task-container')) {
		var activeTask = document.querySelector('.task-container.active');
		if (activeTask) {
			var taskInput = activeTask.querySelector('input[type="text"]');
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

	// Reset cursor on non-focused inputs
	state.appContainer.addEventListener('focusin', function(e) {
		if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
			document.querySelectorAll('input[type="text"]').forEach(input => {
				if (input !== e.target) {
					placeCursorAtBeginning(input);
				}
			});
		}
	});

	// Initialize
	setInitialTheme();
	renderCurrentView();
	selectFirstSubtask();
});
