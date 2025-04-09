package services


type MediaProcessor struct {
	OpenAIService *OpenAIService
}

func NewMediaProcessor(openAIService *OpenAIService) *MediaProcessor {
	return &MediaProcessor{
		OpenAIService: openAIService,
	}
}

func (mp *MediaProcessor) ProcessMedia(mediaType string, mediaURL string) (string, error) {
	return mp.OpenAIService.ProcessMedia(mediaType, mediaURL)
}

func (mp *MediaProcessor) AggregateMedia(items []struct {
	MediaType string
	MediaURL  string
}) (string, error) {
	return mp.OpenAIService.AggregateMedia(items)
}
