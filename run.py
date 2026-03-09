#!/usr/bin/env python3

import http.server, webbrowser, threading, signal

PORT = 8000
server = http.server.HTTPServer(("", PORT), http.server.SimpleHTTPRequestHandler)

def shutdown(sig, frame):
	print("\nShutting down...")
	threading.Thread(target=server.shutdown).start()

signal.signal(signal.SIGINT, shutdown)
threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
print(f"Serving on http://localhost:{PORT} (Ctrl+C to stop)")
server.serve_forever()
