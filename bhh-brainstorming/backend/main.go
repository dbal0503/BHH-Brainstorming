package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Basic message structure
type Message struct {
	Type      string      `json:"type"`
	Username  string      `json:"username,omitempty"`
	SessionId string      `json:"sessionId,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	log.Println("Client connected")

	// Simple echo handler for now
	for {
		// Read message
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		log.Printf("Received: %s", message)

		// Echo the message back
		if err := conn.WriteMessage(messageType, message); err != nil {
			log.Println("Error writing message:", err)
			break
		}
	}

	log.Println("Client disconnected")
}

func main() {
	// Define a simple health check endpoint
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","message":"Server is running"}`))
	})

	// WebSocket endpoint
	http.HandleFunc("/ws", handleWebSocket)

	// Start the server
	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Server error:", err)
	}
}
