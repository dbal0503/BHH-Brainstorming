package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"bhh-brainstorming/backend/handlers"
	"bhh-brainstorming/backend/services"
	"bhh-brainstorming/backend/websocket"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: Error loading .env file:", err)
	}

	// Get OpenAI API key from environment variable
	openAIKey := os.Getenv("OPENAI_API_KEY")
	if openAIKey == "" {
		log.Println("Warning: OPENAI_API_KEY environment variable not set. Media aggregation will not work.")
	}

	// Create services
	openAIService := services.NewOpenAIService(openAIKey)
	mediaProcessor := services.NewMediaProcessor(openAIService)

	// Initialize hub with services
	hub := websocket.NewHub()
	hub.SetMediaProcessor(mediaProcessor)
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

	http.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir("./media"))))
	http.HandleFunc("/api/upload", handlers.UploadMediaHandler)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Server error:", err)
	}
}
