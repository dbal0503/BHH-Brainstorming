package main

import (
	"log"
	"net/http"

	"bhh-brainstorming/backend/websocket"
)

func main() {
	hub := websocket.NewHub()
	go hub.Run()

	// Health check endpoint.
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "message": "Server is running"}`))
	})

	// Use the Hub-based WebSocket handler.
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(hub, w, r)
	})

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Server error:", err)
	}
}
