// Theme: theme selection, cycling, and persistence

function cycleTheme() {
	state.currentThemeIndex = (state.currentThemeIndex + 1) % state.themes.length;
	var newTheme = state.themes[state.currentThemeIndex];
	setTheme(newTheme);
	saveThemeToLocalStorage(newTheme);
}

function saveThemeToLocalStorage(theme) {
	localStorage.setItem('currentTheme', theme);
}

function updateFavicon() {
	var iconEmoji = getComputedStyle(document.documentElement).getPropertyValue('--icon').trim().replace(/'/g, '');
	var faviconLink = document.querySelector('link[rel="icon"]');
	if (faviconLink && iconEmoji) {
		faviconLink.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${iconEmoji}</text></svg>`;
	}
}

function setTheme(theme) {
	document.documentElement.setAttribute('data-theme', theme);
	var backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
	document.getElementById('themeColor').setAttribute('content', backgroundColor);
	updateFavicon();
}

function setInitialTheme() {
	var savedTheme = localStorage.getItem('currentTheme');
	var defaultTheme = document.documentElement.getAttribute('data-theme');

	if (savedTheme && state.themes.includes(savedTheme)) {
		state.currentThemeIndex = state.themes.indexOf(savedTheme);
	} else if (state.themes.includes(defaultTheme)) {
		state.currentThemeIndex = state.themes.indexOf(defaultTheme);
	} else {
		state.currentThemeIndex = 0;
	}

	setTheme(state.themes[state.currentThemeIndex]);
}
