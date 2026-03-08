const CACHE_NAME = 'matryoshka-v1';
const ASSETS = [
	'./',
	'index.html',
	'manifest.json',
	'resources/main.css',
	'resources/state.js',
	'resources/storage.js',
	'resources/task-model.js',
	'resources/multi-select.js',
	'resources/navigation.js',
	'resources/reorganize.js',
	'resources/keyboard.js',
	'resources/render.js',
	'resources/task-element.js',
	'resources/theme.js',
	'resources/main.js',
	'resources/icons/icon.svg',
	'resources/fonts/Basteleur-Moonlight.ttf',
];

// Cache assets on install
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(
				keys.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			))
			.then(() => self.clients.claim())
	);
});

// Serve from cache, fall back to network, and update cache
self.addEventListener('fetch', (event) => {
	event.respondWith(
		caches.match(event.request).then((cached) => {
			const fetchPromise = fetch(event.request).then((response) => {
				// Only cache same-origin, successful GET requests
				if (response.ok && event.request.method === 'GET') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, clone);
					});
				}
				return response;
			}).catch(() => cached);

			return cached || fetchPromise;
		})
	);
});
