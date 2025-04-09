package services

import (
	"bhh-brainstorming/backend/handlers"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"

	"context"
	"encoding/json"
	"errors"
)

type OpenAIService struct {
	OpenAIKey string
}
type APIRequest struct {
	Model    string
	Messages []Message
}

type Message struct {
	Role    string
	Content Content
}

type Content struct {
	ContentType string
	Text        string
	ImageURL    string
}

func NewOpenAIService(openAIKey string) *OpenAIService {
	return &OpenAIService{OpenAIKey: openAIKey}
}
func CreateContent(contenttype string, text string, imageurl string) Content {
	return Content{ContentType: contenttype, Text: text, ImageURL: imageurl}
}
func CreateMessage(role string, content Content) Message {
	return Message{Role: role, Content: content}
}
func CreateAPIRequest(mediaType string, mediaURL string) (APIRequest, error) {
	if handlers.IsAllowedType(mediaType) {
		content := CreateContent(mediaType, "", mediaURL)
		message := CreateMessage("user", content)
		messages := []Message{message}
		model := "gpt-4o-mini"
		return APIRequest{Model: model, Messages: messages}, nil
	}
	return APIRequest{}, errors.New("invalid media type")
}

func (o *OpenAIService) ProcessMedia(mediaType string, mediaURL string) (string, error) {
	request, err := CreateAPIRequest(mediaType, mediaURL)
	if err != nil {
		return "", err
	}

	response, err := o.callOpenAI(request)
	if err != nil {
		return "", err
	}

	var result map[string]string
	if err := json.Unmarshal(response, &result); err != nil {
		return "", err
	}

	return result["content"], nil
}

func (o *OpenAIService) AggregateMedia(items []struct {
	MediaType string
	MediaURL  string
}) (string, error) {

	systemMessage := CreateMessage("system", Content{
		ContentType: "text",
		Text:        "You are tasked with aggregating and summarizing multiple pieces of content across different media types. Provide a comprehensive summary that captures key insights from all sources.",
	})

	messages := []Message{systemMessage}

	for _, item := range items {
		content, err := o.ProcessMedia(item.MediaType, item.MediaURL)
		if err != nil {
			return "", err
		}

		messages = append(messages, CreateMessage("user", Content{
			ContentType: "text",
			Text:        "Content from " + item.MediaType + ": " + content,
		}))
	}

	messages = append(messages, CreateMessage("user", Content{
		ContentType: "text",
		Text:        "Please provide a comprehensive summary and analysis that aggregates all the information above.",
	}))

	request := APIRequest{
		Model:    "gpt-4o",
		Messages: messages,
	}

	response, err := o.callOpenAI(request)
	if err != nil {
		return "", err
	}

	var result map[string]string
	if err := json.Unmarshal(response, &result); err != nil {
		return "", err
	}

	return result["content"], nil
}

func (o *OpenAIService) callOpenAI(request APIRequest) ([]byte, error) {
	client := openai.NewClient(
		option.WithAPIKey(o.OpenAIKey),
	)

	messages := []openai.ChatCompletionMessageParamUnion{}

	for _, msg := range request.Messages {
		switch msg.Content.ContentType {
		case "image", "image/jpeg", "image/png":
			messages = append(messages, openai.ChatCompletionMessageParamUnion{
				OfUser: &openai.ChatCompletionUserMessageParam{
					Content: openai.ChatCompletionUserMessageParamContentUnion{
						OfString: openai.String("Image URL: " + msg.Content.ImageURL +
							"\nPlease describe this image and extract any relevant information from it."),
					},
				},
			})

		case "audio", "audio/mp3", "audio/wav", "audio/mpeg":
			messages = append(messages, openai.ChatCompletionMessageParamUnion{
				OfUser: &openai.ChatCompletionUserMessageParam{
					Content: openai.ChatCompletionUserMessageParamContentUnion{
						OfString: openai.String("Please analyze this audio content at " +
							msg.Content.ImageURL + " and extract key information."),
					},
				},
			})

		case "video", "video/mp4":
			messages = append(messages, openai.ChatCompletionMessageParamUnion{
				OfUser: &openai.ChatCompletionUserMessageParam{
					Content: openai.ChatCompletionUserMessageParamContentUnion{
						OfString: openai.String("Please analyze this video content at " +
							msg.Content.ImageURL + " and extract key information."),
					},
				},
			})

		case "text", "text/plain", "text/link":
			content := msg.Content.Text
			if content == "" && msg.Content.ImageURL != "" {
				content = "Please analyze this content: " + msg.Content.ImageURL
			}

			messages = append(messages, openai.ChatCompletionMessageParamUnion{
				OfUser: &openai.ChatCompletionUserMessageParam{
					Content: openai.ChatCompletionUserMessageParamContentUnion{
						OfString: openai.String(content),
					},
				},
			})

		default:
			messages = append(messages, openai.ChatCompletionMessageParamUnion{
				OfUser: &openai.ChatCompletionUserMessageParam{
					Content: openai.ChatCompletionUserMessageParamContentUnion{
						OfString: openai.String("Please analyze this content: " + msg.Content.ImageURL),
					},
				},
			})
		}
	}

	ctx := context.Background()

	completion, err := client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model:    request.Model,
		Messages: messages,
	})

	if err != nil {
		return nil, err
	}

	responseContent := completion.Choices[0].Message.Content

	return json.Marshal(map[string]string{
		"content": responseContent,
	})
}
