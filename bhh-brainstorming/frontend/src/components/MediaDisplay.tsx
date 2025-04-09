import React from 'react';
import { mediaService } from '../services/mediaservice';
import './MediaDisplay.css';

interface MediaDisplayProps {
  mediaType: string;
  mediaURL?: string;
  content: string;
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({ mediaType, mediaURL, content }) => {
  // If no mediaURL is provided, just show the content
  if (!mediaURL) {
    return (
      <div className="media-display text-only">
        <p>{content}</p>
      </div>
    );
  }

  // Get the full URL for the media
  const fullMediaUrl = mediaService.getMediaUrl(mediaURL);

  return (
    <div className="media-display">
      {mediaType.startsWith('image') && (
        <div className="media-container">
          <img 
            src={fullMediaUrl} 
            alt="Uploaded content" 
            className="media-content"
          />
        </div>
      )}

      {mediaType.startsWith('video') && (
        <div className="media-container">
          <video 
            src={fullMediaUrl} 
            controls 
            className="media-content"
          />
        </div>
      )}

      {mediaType.startsWith('audio') && (
        <div className="media-container">
          <audio 
            src={fullMediaUrl} 
            controls 
            className="media-content"
          />
        </div>
      )}

      <div className="content-container">
        <p>{content}</p>
      </div>
    </div>
  );
};

// Specialized component for displaying aggregation results
export const AggregationDisplay: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="aggregation-display">
      <h3>AI-Generated Summary</h3>
      <div className="aggregation-content">
        {content.split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
};

export default MediaDisplay; 