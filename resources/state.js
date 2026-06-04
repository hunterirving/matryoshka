// Shared mutable application state

var state = {
	appContainer: null,
	rootTask: null,
	currentTask: null,
	taskPath: [],
	lastSubtaskDownArrowReleased: false,
	lastSubtaskShiftDownReleased: false,
	saveTimer: null,
	currentThemeIndex: 0,
	isF2Pressed: false,
	themes: ['gak', 'swamp', 'sunflower', 'harvest', 'sugar', 'vineyard', 'woodstove', 'medieval', 'goblin'],
	isInWheelEvent: false,

	// Multi-select state
	multiSelectAnchorId: null,
	multiSelectedIds: [],
};

function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
