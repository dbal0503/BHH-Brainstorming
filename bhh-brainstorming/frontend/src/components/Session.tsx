// File: frontend/src/components/Session.tsx
import React, { useState, useEffect } from 'react';
import { websocketService, ISession, Message } from '../services/websocketservice';
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
  const [ideaContent, setIdeaContent] = useState('');
  const [aggregatedResult, setAggregatedResult] = useState('');
  const [rating, setRating] = useState<Rating>({ novelty: 1, feasibility: 1, usefulness: 1 });
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [discussionStarted, setDiscussionStarted] = useState(false);

  useEffect(() => {
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
    websocketService.on('aggregation_result', (data: React.SetStateAction<string>) => {
      setAggregatedResult(data);
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
      websocketService.off('aggregation_result', () => {});
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
    }
  };

  const handleSendChat = () => {
    if (currentSessionId && inputMessage.trim() !== '') {
      websocketService.sendSessionMessage(currentSessionId, inputMessage);
      setInputMessage('');
    }
  };

  const handleSubmitIdea = () => {
    if (currentSessionId && ideaContent.trim() !== '') {
      websocketService.submitIdea(currentSessionId, ideaContent, 'text');
      setIdeaContent('');
    }
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

  return (
    <div className="session-container">
      {!connected ? (
        <div className="login-container">
          <h2>Enter Username</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={handleConnect}>Connect</button>
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
          )
      }

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
                  Leave
                </button>
                </div>
              </div>

              {/* Session Chat Section */}
              <div className="chat-section">
                <h2>Session Chat</h2>

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

                <div className="idea-submission">
                  <h3>Submit Your Idea</h3>
                  <textarea
                    className="idea-textarea"
                    placeholder="Enter your idea here"
                    value={ideaContent}
                    onChange={(e) => setIdeaContent(e.target.value)}
                  ></textarea>
                  <div className="submission-buttons">
                    <button onClick={handleSubmitIdea}>Submit Idea</button>
                    <button onClick={handleAggregateIdeas}>Aggregate Ideas</button>
                  </div>
                </div>

                {aggregatedResult && (
                  <div className="aggregation-result">
                    <h3 className="aggregation-title">Brainstorm Summary</h3>
                    <p>{aggregatedResult}</p>
                    <button onClick={handleStartDiscussion}>Start Discussion</button>
                  </div>
                )}

                {discussionStarted && (
                  <div className="discussion-chat">
                    <h3>Group Discussion</h3>
                    <div className="chat-container">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className="chat-message">
                          <strong>{msg.username ? `${msg.username}: ` : ''}</strong>
                          <span>{msg.data}</span>
                          <button onClick={() => setSelectedIdeaId(`idea-${index}`)}>Rate</button>
                          {selectedIdeaId === `idea-${index}` && (
                            <div className="rating-form">
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={rating.novelty}
                                onChange={(e) =>
                                  setRating({ ...rating, novelty: Number(e.target.value) })
                                }
                                placeholder="Novelty"
                              />
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={rating.feasibility}
                                onChange={(e) =>
                                  setRating({ ...rating, feasibility: Number(e.target.value) })
                                }
                                placeholder="Feasibility"
                              />
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={rating.usefulness}
                                onChange={(e) =>
                                  setRating({ ...rating, usefulness: Number(e.target.value) })
                                }
                                placeholder="Usefulness"
                              />
                              <input
                                type="text"
                                placeholder="Optional comment"
                                onChange={(e) =>
                                  setRating({ ...rating, comment: e.target.value })
                                }
                              />
                              <button onClick={() => handleSubmitRating(`idea-${index}`)}>
                                Submit Rating
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="chat-input-group">
                      <input
                        type="text"
                        placeholder="Type a message for discussion"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                      />
                      <button onClick={handleSendChat}>Send</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Session;
