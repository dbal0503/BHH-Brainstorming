// File: frontend/src/components/Session.tsx
import React, { useState, useEffect } from 'react';
import { websocketService, ISession, Message, Idea } from '../services/websocketservice';
import MediaUploader from './MediaUploader';
import MediaDisplay, { AggregationDisplay } from './MediaDisplay';
import './Session.css';

interface Rating {
  novelty: number;
  feasibility: number;
  usefulness: number;
  comment?: string;
}

const Session: React.FC = () => {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [guidingQuestions, setGuidingQuestions] = useState('');
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [aggregatedResult, setAggregatedResult] = useState('');
  const [rating, setRating] = useState<Rating>({ novelty: 1, feasibility: 1, usefulness: 1 });
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [discussionStarted, setDiscussionStarted] = useState(false);

  const generateUsername = (): string => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let word = '';
    for (let i = 0; i < 5; i++) {
      word += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    const numbers = Math.floor(Math.random() * 900 + 100); // Generates a number between 100 and 999
    return word + numbers;
  };
  const [isAggregating, setIsAggregating] = useState(false);

  useEffect(() => {
    setUsername(generateUsername());
    websocketService.on('sessions_list', (data: React.SetStateAction<ISession[]>) => {
      setSessions(data);
    });
    websocketService.on('session_created', (data: ISession) => {
      setCurrentSessionId(data.id);
      setSessions((prev: ISession[]) => [data, ...prev.filter((s) => s.id !== data.id)]);
    });
    websocketService.on('session_joined', (data: { id: React.SetStateAction<string> }) => {
      setCurrentSessionId(data.id);
    });
    websocketService.on('session_updated', (data: ISession) => {
      setSessions((prev: ISession[]) =>
        prev.map((s) => (s.id === data.id ? data : s))
      );
    });
    websocketService.on('session_message', (data: any) => {
      setChatMessages((prev) => [...prev, { type: 'session_message', data }]);
    });
    websocketService.on('idea_submitted', (data: any) => {
      setChatMessages((prev) => [...prev, { type: 'idea_submitted', data }]);
    });
    websocketService.on('aggregation_started', (data: any) => {
      setIsAggregating(true);
      setChatMessages((prev) => [...prev, { type: 'aggregation_started', data }]);
    });
    websocketService.on('aggregation_result', (data: React.SetStateAction<string>) => {
      setAggregatedResult(data);
      setIsAggregating(false);
    });
    websocketService.on('aggregation_error', (data: any) => {
      setIsAggregating(false);
      setChatMessages((prev) => [...prev, { type: 'error', data }]);
    });
    websocketService.on('idea_rating', (data: any) => {
      console.log('Received idea rating:', data);
    });
    websocketService.on('discussion_started', (data: any) => {
      setDiscussionStarted(true);
      setChatMessages((prev) => [...prev, { type: 'discussion', data }]);
    });
    return () => {
      websocketService.off('sessions_list', () => {});
      websocketService.off('session_created', () => {});
      websocketService.off('session_joined', () => {});
      websocketService.off('session_updated', () => {});
      websocketService.off('session_message', () => {});
      websocketService.off('idea_submitted', () => {});
      websocketService.off('aggregation_started', () => {});
      websocketService.off('aggregation_result', () => {});
      websocketService.off('aggregation_error', () => {});
      websocketService.off('idea_rating', () => {});
      websocketService.off('discussion_started', () => {});
    };
  }, []);

  const handleConnect = () => {
    if (username.trim() !== '') {
      websocketService.connect(username).then(() => {
        setConnected(true);
      });
    }
  };

  const handleCreateSession = () => {
    if (sessionName.trim() !== '' && guidingQuestions.trim() !== '') {
      const questions = guidingQuestions.split('\n').filter((q) => q.trim() !== '');
      websocketService.createSession(sessionName, questions);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    websocketService.joinSession(sessionId);
  };

  const handleLeaveSession = () => {
    if (currentSessionId) {
      websocketService.leaveSession();
      setCurrentSessionId('');
      setAggregatedResult('');
      setDiscussionStarted(false);
      setChatMessages([]);
      setIsAggregating(false);
    }
  };

  const handleSendChat = () => {
    if (currentSessionId && inputMessage.trim() !== '') {
      websocketService.sendSessionMessage(currentSessionId, inputMessage);
      setInputMessage('');
    }
  };

  const handleMediaUploaded = (mediaType: string, mediaURL: string, content: string) => {
    // This function is now handled by the MediaUploader component
    console.log('Media uploaded:', { mediaType, mediaURL, content });
  };

  const handleAggregateIdeas = () => {
    if (currentSessionId) {
      websocketService.aggregateIdeas(currentSessionId);
    }
  };

  const handleSubmitRating = (ideaId: string) => {
    if (currentSessionId) {
      websocketService.sendIdeaRating(currentSessionId, ideaId, rating);
      setSelectedIdeaId(null);
      setRating({ novelty: 1, feasibility: 1, usefulness: 1 });
    }
  };

  const handleStartDiscussion = () => {
    if (currentSessionId) {
      websocketService.startDiscussion(currentSessionId);
    }
  };

  // Get the current session object
  const currentSession = sessions.find((session) => session.id === currentSessionId);

  return (
    <div className="session-container">
      {!connected ? (
        <div className="login-container">
          <h2>Your Generated Username</h2>
          <div className="username-display">
            {username}
          </div>
          <button onClick={() => setUsername(generateUsername())}>Re-Generate Username</button>
          <button onClick={handleConnect} style={{ marginTop: '10px' }}>Connect</button>
        </div>
      ) : (
        <>
          <h1 className="header">Welcome, {username}</h1>
          {/* Create Session Section */}
          {!currentSessionId && (
            <div className="create-session">
              <h2>Create Session</h2>
              <input
                type="text"
                placeholder="Session Name"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
              <textarea
                placeholder="Enter Guiding Questions (one per line)"
                value={guidingQuestions}
                onChange={(e) => setGuidingQuestions(e.target.value)}
              ></textarea>
              <button onClick={handleCreateSession}>Create Session</button>
            </div>
          )}

          {/* If not in a session, show available sessions */}
          {!currentSessionId && (
            <div className="available-sessions">
              <h2>Available Sessions</h2>
              {sessions.length === 0 && <p>No sessions available.</p>}
              <div className="session-list">
                <ul>
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <span>
                        <strong>{session.name}</strong> (ID: {session.id}) - Created by{' '}
                        {session.creator.username}
                      </span>
                      <button onClick={() => handleJoinSession(session.id)}>Join</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* If in a session, show current session info */}
          {currentSessionId && (
            <>
              <div className="current-session">
                <h2>Current Session</h2>
                <div className="session-info">
                  <p className="session-id-section">ID: <span className="session-id">{currentSessionId}</span></p>
                  <button className="leave-button" onClick={handleLeaveSession}>
                    Leave Session
                  </button>
                </div>
                {currentSession && (
                  <div className="guiding-questions">
                  <h3>Guiding Questions</h3>
                  <div className="guiding-question-list">
                    {sessions
                      .find((s) => s.id === currentSessionId)
                      ?.guidingQuestions.map((q, idx) => (
                        <div key={idx} className="guiding-question-item">
                          {q}
                        </div>
                      ))}
                  </div>
                </div>
                )}
              </div>

              {/* Idea submission section with media upload */}
              <div className="idea-submission">
                <h3>Share Your Ideas</h3>
                <MediaUploader 
                  onMediaUploaded={handleMediaUploaded}
                  sessionId={currentSessionId}
                />
              </div>

              {/* Ideas display section */}
              {currentSession && currentSession.ideas.length > 0 && (
                <div className="ideas-section">
                  <h3>Ideas Shared:</h3>
                  <div className="ideas-list">
                    {currentSession.ideas.map((idea: Idea) => (
                      <div className="idea-card" key={idea.id}>
                        <div className="idea-header">
                          <span className="idea-author">{idea.submittedBy.username}</span>
                        </div>
                        
                        <MediaDisplay 
                          mediaType={idea.mediaType}
                          mediaURL={idea.mediaURL}
                          content={idea.content}
                        />
                        
                        {/* Rating interface */}
                        {!discussionStarted && selectedIdeaId === idea.id ? (
                          <div className="rating-form">
                            <h4>Rate this idea:</h4>
                            <div className="rating-sliders">
                              <div className="rating-item">
                                <label>Novelty: {rating.novelty}</label>
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  value={rating.novelty}
                                  onChange={(e) =>
                                    setRating({ ...rating, novelty: parseInt(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="rating-item">
                                <label>Feasibility: {rating.feasibility}</label>
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  value={rating.feasibility}
                                  onChange={(e) =>
                                    setRating({ ...rating, feasibility: parseInt(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="rating-item">
                                <label>Usefulness: {rating.usefulness}</label>
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  value={rating.usefulness}
                                  onChange={(e) =>
                                    setRating({ ...rating, usefulness: parseInt(e.target.value) })
                                  }
                                />
                              </div>
                            </div>
                            <div className="rating-comment">
                              <label>Comment (optional):</label>
                              <textarea
                                value={rating.comment || ''}
                                onChange={(e) =>
                                  setRating({ ...rating, comment: e.target.value })
                                }
                              ></textarea>
                            </div>
                            <div className="rating-actions">
                              <button onClick={() => handleSubmitRating(idea.id)}>Submit Rating</button>
                              <button onClick={() => setSelectedIdeaId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          !discussionStarted && (
                            <button
                              onClick={() => setSelectedIdeaId(idea.id)}
                              className="rate-button"
                            >
                              Rate this idea
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aggregation section */}
              <div className="aggregation-section">
                {isAggregating && (
                  <div className="aggregating-message">
                    <p>Aggregating ideas... This may take a moment.</p>
                  </div>
                )}
                
                {aggregatedResult && (
                  <AggregationDisplay content={aggregatedResult} />
                )}
                
                {aggregatedResult && !discussionStarted && (
                  <button onClick={handleStartDiscussion} className="start-discussion">
                    Start Group Discussion
                  </button>
                )}
              </div>
              {/* Discussion section */}
              {discussionStarted && (
                <div className="discussion-section">
                  <h3>Group Discussion</h3>
                  <div className="chat-messages">
                    {chatMessages
                      .filter((msg) => msg.type === 'session_message')
                      .map((msg, idx) => (
                        <div key={idx} className="chat-message">
                          <strong>{msg.username || 'Anonymous'}:</strong> {msg.data}
                        </div>
                      ))}
                  </div>
                  <div className="chat-input">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your message..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <button onClick={handleSendChat}>Send</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Session;
