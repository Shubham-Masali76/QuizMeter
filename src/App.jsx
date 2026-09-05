import { useState, useEffect } from "react";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { db, auth } from "./services/firebase";

import "./App.css";

function DashboardLayout({
  children,
  page,
  setPage,
  handleMyQuizzes,
  handleLogout,
}) {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">QuizMeter</div>

        <nav className="sidebar-nav">
          <button
            className={page === "dashboard" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={page === "quizzes" ? "nav-item active" : "nav-item"}
            onClick={handleMyQuizzes}
          >
            My Quizzes
          </button>

          <button
            className={page === "create" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("create")}
          >
            + Create Quiz
          </button>

          <button className="nav-item logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </aside>

      <main className="dashboard-content">{children}</main>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="toast">
      <span className="toast-icon">✓</span>
      <span>{message}</span>
    </div>
  );
}

function RoleSelection({ onSelectRole }) {
  return (
    <div className="role-page">
      <div className="role-selection-container">
        <div className="role-logo">QuizMeter</div>
        <h1>Welcome to QuizMeter</h1>
        <p className="role-subtitle">Choose how you would like to continue:</p>

        <div className="role-cards-grid">
          <div
            className="role-card host-card"
            onClick={() => onSelectRole("host")}
          >
            <div className="role-icon">👨‍🏫</div>
            <h2>Host</h2>
            <p>Create, manage, and host live quizzes for your audience.</p>
            <button
              type="button"
              className="primary-btn role-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("host");
              }}
            >
              Continue as Host →
            </button>
          </div>

          <div
            className="role-card participant-card"
            onClick={() => onSelectRole("participant")}
          >
            <div className="role-icon">👤</div>
            <h2>Participant</h2>
            <p>Join and play live quizzes with a code. No login required.</p>
            <button
              type="button"
              className="secondary-btn role-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole("participant");
              }}
            >
              Continue as Participant →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinQuizScreen({ selectedQuiz, onBack }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!normalizedCode) {
      showMessage("Please enter the quiz code.");
      return;
    }

    const codeRegex = /^[A-Z0-9]{6}$/;
    if (!codeRegex.test(normalizedCode)) {
      showMessage("Quiz code must be 6 characters using A-Z and 0-9.");
      return;
    }

    if (!trimmedName) {
      showMessage("Please enter your name.");
      return;
    }

    if (trimmedName.length > 30) {
      showMessage("Name cannot exceed 30 characters.");
      return;
    }

    setIsVerifying(true);

    try {
      const q = query(
        collection(db, "quizzes"),
        where("quizCode", "==", normalizedCode),
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showMessage("Quiz not found. Please check the quiz code.");
        setIsVerifying(false);
        return;
      }

      const quizDoc = querySnapshot.docs[0];
      const quizData = quizDoc.data();

      if (quizData.status !== "waiting" && quizData.status !== "live") {
        showMessage("This quiz is no longer available.");
        setIsVerifying(false);
        return;
      }

      if (quizDoc.id !== selectedQuiz.id) {
        showMessage("The quiz code does not match the selected quiz.");
        setIsVerifying(false);
        return;
      }

      showMessage("Quiz verified! Participant lobby will be implemented next.");
    } catch (err) {
      console.error("Error verifying quiz code:", err);
      showMessage(
        "Something went wrong while verifying the quiz. Please try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="join-quiz-page">
      <div className="join-quiz-card">
        <div className="role-logo">QuizMeter</div>
        <h1>Join Quiz</h1>
        <p className="join-quiz-subtitle">
          Enter the code and your name to join this challenge
        </p>

        <div className="join-quiz-info-box">
          <h3>{selectedQuiz.title}</h3>
          {selectedQuiz.description && <p>{selectedQuiz.description}</p>}
        </div>

        <form onSubmit={handleJoinSubmit}>
          <div className="join-quiz-field">
            <label>Quiz Code</label>
            <input
              type="text"
              placeholder="e.g. R19UNG"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="quiz-code-input"
              disabled={isVerifying}
            />
          </div>

          <div className="join-quiz-field">
            <label>Your Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              disabled={isVerifying}
            />
          </div>

          <button
            type="submit"
            className="primary-btn join-quiz-submit-btn"
            disabled={isVerifying}
          >
            {isVerifying ? "Verifying..." : "Join Quiz →"}
          </button>

          <button
            type="button"
            className="join-quiz-back-btn"
            onClick={onBack}
            disabled={isVerifying}
          >
            ← Back to Live Quizzes
          </button>
        </form>
      </div>

      <Toast message={message} />
    </div>
  );
}

function ParticipantLiveQuizzes({ onBack }) {
  const [liveQuizzes, setLiveQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, "quizzes"),
        where("status", "in", ["waiting", "live"]),
      );

      const querySnapshot = await getDocs(q);

      const quizzesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        description: doc.data().description,
        status: doc.data().status,
      }));

      setLiveQuizzes(quizzesData);
    } catch (err) {
      console.error("Error fetching live quizzes:", err);
      setError("Failed to load live quizzes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadInitialQuizzes = async () => {
      try {
        const q = query(
          collection(db, "quizzes"),
          where("status", "in", ["waiting", "live"]),
        );

        const querySnapshot = await getDocs(q);

        if (!isCancelled) {
          const quizzesData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            title: doc.data().title,
            description: doc.data().description,
            status: doc.data().status,
          }));

          setLiveQuizzes(quizzesData);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error fetching live quizzes:", err);
          setError("Failed to load live quizzes. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialQuizzes();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleJoinQuiz = (quiz) => {
    setSelectedQuiz(quiz);
  };

  if (selectedQuiz) {
    return (
      <JoinQuizScreen
        selectedQuiz={selectedQuiz}
        onBack={() => setSelectedQuiz(null)}
      />
    );
  }

  return (
    <div className="participant-page">
      <header className="participant-header">
        <div className="participant-header-content">
          <div className="participant-logo">QuizMeter</div>
          <button
            type="button"
            className="secondary-btn participant-back-btn"
            onClick={onBack}
          >
            ← Back to Role Selection
          </button>
        </div>
      </header>

      <main className="participant-main">
        <div className="participant-intro">
          <div>
            <h1>Live Quizzes</h1>
            <p>Quizzes currently available to join</p>
          </div>

          <button
            type="button"
            className="refresh-quizzes-btn"
            onClick={fetchQuizzes}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="participant-loading">
            <h2>Loading live quizzes...</h2>
          </div>
        ) : error ? (
          <div className="participant-error-box">
            <p>{error}</p>
            <button
              type="button"
              className="primary-btn"
              onClick={fetchQuizzes}
            >
              Try Again
            </button>
          </div>
        ) : liveQuizzes.length === 0 ? (
          <div className="participant-empty-card">
            <div className="empty-icon">🎯</div>
            <h3>No live quizzes are available right now.</h3>
            <p>
              When a host starts hosting a quiz, it will appear here. Click
              Refresh to check again!
            </p>
            <button
              type="button"
              className="secondary-btn"
              onClick={fetchQuizzes}
            >
              ↻ Check Again
            </button>
          </div>
        ) : (
          <div className="participant-quiz-grid">
            {liveQuizzes.map((quiz) => (
              <div className="participant-quiz-card" key={quiz.id}>
                <div className="participant-quiz-info">
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description}</p>
                </div>

                <div className="participant-card-status">
                  <span className="available-badge">🟢 Available</span>
                </div>

                <button
                  type="button"
                  className="primary-btn join-quiz-btn"
                  onClick={() => handleJoinQuiz(quiz)}
                >
                  Join Quiz →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AuthPage({
  authPage,
  setAuthPage,
  handleLogin,
  handleSignup,
  onBack,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (authPage === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (authPage === "login") {
        await handleLogin(email, password);
      } else {
        await handleSignup(email, password);
      }
    } catch (error) {
      switch (error.code) {
        case "auth/weak-password":
          setError("Password must be at least 6 characters.");
          break;

        case "auth/email-already-in-use":
          setError("An account with this email already exists.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/invalid-credential":
          setError("Incorrect email or password.");
          break;

        case "auth/user-not-found":
          setError("No account was found with this email.");
          break;

        case "auth/wrong-password":
          setError("Incorrect email or password.");
          break;

        default:
          setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {onBack && (
          <button type="button" className="auth-back-btn" onClick={onBack}>
            ← Back to Role Selection
          </button>
        )}
        <div className="auth-logo">QuizMeter</div>

        <h1>{authPage === "login" ? "Welcome Back" : "Create Account"}</h1>

        <p className="auth-subtitle">
          {authPage === "login"
            ? "Login to continue to QuizMeter."
            : "Create your QuizMeter account."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {authPage === "signup" && (
            <div className="auth-field">
              <label>Confirm Password</label>

              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="primary-btn auth-submit">
            {authPage === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          {authPage === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthPage("signup");
                  setError("");
                }}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthPage("login");
                  setError("");
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const generateQuizCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

const generateUniqueQuizCode = async () => {
  let isUnique = false;
  let code = "";

  while (!isUnique) {
    code = generateQuizCode();

    const codeQuery = query(
      collection(db, "quizzes"),
      where("quizCode", "==", code),
    );

    const querySnapshot = await getDocs(codeQuery);

    if (querySnapshot.empty) {
      isUnique = true;
    }
  }

  return code;
};

function HostWaitingRoom({
  quizId,
  initialTitle,
  initialDescription,
  initialCode,
  setPage,
  setQuizStatus,
}) {
  const [participants, setParticipants] = useState([]);
  const [quizData, setQuizData] = useState({
    title: initialTitle,
    description: initialDescription,
    quizCode: initialCode,
    status: "waiting",
  });
  const [loading, setLoading] = useState(Boolean(quizId));
  const [error, setError] = useState(quizId ? "" : "No quiz selected.");
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  useEffect(() => {
    if (!quizId) {
      return;
    }

    const quizDocRef = doc(db, "quizzes", quizId);
    const unsubQuiz = onSnapshot(
      quizDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setQuizData((prev) => ({
            ...prev,
            title: data.title || prev.title,
            description: data.description || prev.description,
            quizCode: data.quizCode || prev.quizCode,
            status: data.status || prev.status,
          }));
          if (data.status && setQuizStatus) {
            setQuizStatus(data.status);
          }
        } else {
          setError("This quiz could not be found or was deleted.");
        }
      },
      (err) => {
        console.error("Error listening to quiz doc:", err);
        setError("Failed to load quiz details.");
      },
    );

    const participantsRef = collection(db, "quizzes", quizId, "participants");
    const unsubParticipants = onSnapshot(
      participantsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Anonymous",
          ...d.data(),
        }));
        setParticipants(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to participants:", err);
        setError("Failed to load participants.");
        setLoading(false);
      },
    );

    return () => {
      unsubQuiz();
      unsubParticipants();
    };
  }, [quizId, setQuizStatus]);

  const handleCopyCode = () => {
    if (quizData.quizCode) {
      navigator.clipboard.writeText(quizData.quizCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartQuiz = async () => {
    if (quizData.status !== "waiting") {
      showToast("Quiz can only be started when in waiting status.");
      return;
    }

    if (participants.length === 0) {
      showToast(
        "Waiting for at least one participant to join before starting.",
      );
      return;
    }

    setIsStarting(true);
    try {
      await updateDoc(doc(db, "quizzes", quizId), {
        status: "live",
      });
      if (setQuizStatus) {
        setQuizStatus("live");
      }

      showToast(
        "Quiz is now LIVE! Live quiz gameplay will be implemented next.",
      );
    } catch (err) {
      console.error("Error starting quiz:", err);
      showToast("Failed to start quiz. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const filteredParticipants = participants.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="waiting-room-page">
        <div className="waiting-room-loading">
          <h2>Loading Waiting Room...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="waiting-room-page">
        <div className="waiting-room-error">
          <p>{error}</p>
          <button className="primary-btn" onClick={() => setPage("quizzes")}>
            ← Back to My Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-room-page">
      <div className="waiting-room-top-nav">
        <button className="secondary-btn" onClick={() => setPage("editor")}>
          ← Back to Quiz Editor
        </button>
        <button className="secondary-btn" onClick={() => setPage("quizzes")}>
          My Quizzes
        </button>
      </div>

      <div className="waiting-room-card">
        <div className="waiting-room-header">
          <h1>{quizData.title}</h1>
          {quizData.description && <p>{quizData.description}</p>}
          <div className="waiting-room-status-wrap">
            <span className={`quiz-status ${quizData.status}`}>
              {quizData.status === "waiting"
                ? "🟡 Waiting for participants"
                : quizData.status === "live"
                  ? "🟢 Live"
                  : quizData.status === "finished"
                    ? "⚫ Finished"
                    : "📝 Draft"}
            </span>
          </div>
        </div>

        <div className="waiting-room-code-card">
          <span className="code-label">SHARE QUIZ CODE</span>
          <span className="code-value">{quizData.quizCode || "------"}</span>
          <button className="copy-code-btn" onClick={handleCopyCode}>
            {copied ? "✓ Copied to Clipboard" : "📋 Copy Code"}
          </button>
        </div>

        <div className="waiting-room-counter-card">
          <div className="counter-number">{participants.length}</div>
          <div className="counter-label">
            {participants.length === 1
              ? "Participant Joined"
              : "Participants Joined"}
          </div>
        </div>

        <div className="waiting-room-actions">
          <button
            className="secondary-btn view-participants-btn"
            onClick={() => setShowModal(true)}
          >
            👥 View Participants ({participants.length})
          </button>

          <button
            className={`primary-btn start-quiz-btn ${
              quizData.status === "live" ? "is-live" : ""
            }`}
            onClick={handleStartQuiz}
            disabled={
              isStarting ||
              quizData.status !== "waiting" ||
              participants.length === 0
            }
            title={
              participants.length === 0
                ? "Waiting for at least one participant to join"
                : ""
            }
          >
            {isStarting
              ? "Starting..."
              : quizData.status === "live"
                ? "🟢 Quiz is Live (Active)"
                : "🚀 Start Quiz"}
          </button>

          {quizData.status === "waiting" && participants.length === 0 && (
            <p className="waiting-participant-hint">
              Waiting for at least one participant...
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <div className="dialog-overlay" onClick={() => setShowModal(false)}>
          <div
            className="dialog-box participants-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Joined Participants</h2>
                <p className="modal-subtitle">
                  {participants.length}{" "}
                  {participants.length === 1 ? "participant" : "participants"}{" "}
                  in lobby
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="participant-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search participant name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="clear-search"
                  onClick={() => setSearchTerm("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="participants-scroll-list">
              {participants.length === 0 ? (
                <div className="modal-empty-state">
                  <p>No participants have joined yet.</p>
                  <span>Share the quiz code above to let them join!</span>
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="modal-empty-state">
                  <p>No participants match &quot;{searchTerm}&quot;</p>
                </div>
              ) : (
                <ul className="participant-items-list">
                  {filteredParticipants.map((participant, index) => (
                    <li
                      key={participant.id || index}
                      className="participant-item-row"
                    >
                      <span className="participant-index">#{index + 1}</span>
                      <span className="participant-name">
                        {participant.name}
                      </span>
                      <span className="participant-dot">●</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="primary-btn modal-done-btn"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [page, setPage] = useState("dashboard");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quizId, setQuizId] = useState("");
  const [quizCode, setQuizCode] = useState("");
  const [quizStatus, setQuizStatus] = useState("draft");
  const [question, setQuestion] = useState("");
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [option4, setOption4] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setAuthPage("login");
      } else {
        setSelectedRole("host");
        setPage("dashboard");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignup = async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);

      setMessage("Account created successfully!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Signup error:", error);

      throw error;
    }
  };

  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);

      setSelectedRole("host");
      setPage("dashboard");

      setMessage("Logged in successfully!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);

      setSelectedRole(null);
      setPage("login");
      setMessage("Logged out successfully!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const filteredQuestions = questions.filter((question) =>
    question.question.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreateQuiz = async () => {
    if (!title.trim()) {
      setMessage("Please enter a quiz title!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "quizzes"), {
        title,
        description,
        userId: user.uid,
        createdAt: new Date(),
        status: "draft",
      });

      console.log("Quiz created with ID:", docRef.id);
      setQuizId(docRef.id);
      setQuizCode("");
      setQuizStatus("draft");
      setPage("editor");
      // alert("Quiz created successfully!");

      // setTitle("");
      // setDescription("");
    } catch (error) {
      console.error("Error creating quiz:", error);
      setMessage("Something went wrong while creating the quiz!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  const handleHostQuiz = async () => {
    if (questions.length === 0) {
      setMessage("Please add at least one question before hosting the quiz!");

      setTimeout(() => {
        setMessage("");
      }, 3000);

      return;
    }

    try {
      let codeToUse = quizCode;
      if (!codeToUse) {
        const quizDocSnap = await getDoc(doc(db, "quizzes", quizId));
        if (quizDocSnap.exists() && quizDocSnap.data().quizCode) {
          codeToUse = quizDocSnap.data().quizCode;
        } else {
          codeToUse = await generateUniqueQuizCode();
        }
      }

      await updateDoc(doc(db, "quizzes", quizId), {
        quizCode: codeToUse,
        status: "waiting",
      });

      setQuizCode(codeToUse);
      setQuizStatus("waiting");
      setPage("host-waiting-room");
      setMessage(`Quiz is now waiting for participants! Code: ${codeToUse}`);

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error hosting quiz:", error);

      setMessage("Something went wrong while hosting the quiz!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  const handleAddQuestion = async () => {
    if (
      !question.trim() ||
      !option1.trim() ||
      !option2.trim() ||
      !option3.trim() ||
      !option4.trim() ||
      !correctAnswer
    ) {
      setMessage("Please fill in all the question details!");
      setTimeout(() => {
        setMessage("");
      }, 3000);
      return;
    }

    try {
      const questionData = {
        question,
        options: [option1, option2, option3, option4],
        correctAnswer: Number(correctAnswer),
      };

      if (editingQuestion) {
        // Update existing question
        await updateDoc(
          doc(db, "quizzes", quizId, "questions", editingQuestion.id),
          questionData,
        );

        setMessage("Question updated successfully!");

        setTimeout(() => {
          setMessage("");
        }, 3000);

        setEditingQuestion(null);
      } else {
        // Add new question
        await addDoc(collection(db, "quizzes", quizId, "questions"), {
          ...questionData,
          createdAt: new Date(),
        });

        setMessage("Question added successfully!");

        setTimeout(() => {
          setMessage("");
        }, 3000);
      }

      await fetchQuestions(quizId);

      // Clear form
      setQuestion("");
      setOption1("");
      setOption2("");
      setOption3("");
      setOption4("");
      setCorrectAnswer("");
    } catch (error) {
      console.error("Error saving question:", error);
      setMessage("Something went wrong while saving the question!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  const fetchQuestions = async (id) => {
    try {
      const querySnapshot = await getDocs(
        collection(db, "quizzes", id, "questions"),
      );

      const questionList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setQuestions(questionList);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setMessage("Something went wrong while fetching the questions!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  const handleEditQuestion = (question) => {
    setQuestion(question.question);
    setOption1(question.options[0]);
    setOption2(question.options[1]);
    setOption3(question.options[2]);
    setOption4(question.options[3]);
    setCorrectAnswer(String(question.correctAnswer));

    setEditingQuestion(question);
    setPage("editor");
  };

  const handleDeleteQuestion = (question) => {
    setQuestionToDelete(question);
    setShowDeleteDialog(true);
  };

  const confirmDeleteQuestion = async () => {
    try {
      await deleteDoc(
        doc(db, "quizzes", quizId, "questions", questionToDelete.id),
      );

      setShowDeleteDialog(false);
      setQuestionToDelete(null);

      await fetchQuestions(quizId);

      setMessage("Question deleted successfully!");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting question:", error);

      setShowDeleteDialog(false);
      setMessage("Something went wrong while deleting the question.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  const handleMyQuizzes = async () => {
    try {
      const quizzesQuery = query(
        collection(db, "quizzes"),
        where("userId", "==", user.uid),
      );

      const querySnapshot = await getDocs(quizzesQuery);

      const quizList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setQuizzes(quizList);
      setPage("quizzes");
    } catch (error) {
      console.error("Error fetching quizzes:", error);

      setMessage("Something went wrong while loading your quizzes.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <h2>Loading QuizMeter...</h2>
      </div>
    );
  }

  if (!selectedRole) {
    return <RoleSelection onSelectRole={setSelectedRole} />;
  }

  if (selectedRole === "participant") {
    return <ParticipantLiveQuizzes onBack={() => setSelectedRole(null)} />;
  }

  if (!user) {
    return (
      <AuthPage
        authPage={authPage}
        setAuthPage={setAuthPage}
        handleLogin={handleLogin}
        handleSignup={handleSignup}
        onBack={() => setSelectedRole(null)}
      />
    );
  }

  if (page === "dashboard") {
    return (
      <DashboardLayout
        page={page}
        setPage={setPage}
        handleMyQuizzes={handleMyQuizzes}
        handleLogout={handleLogout}
      >
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Manage your quizzes and create new challenges.</p>
          </div>

          <button className="primary-btn" onClick={() => setPage("create")}>
            + Create Quiz
          </button>
        </div>

        <div className="dashboard-actions">
          <div className="dashboard-action-card" onClick={handleMyQuizzes}>
            <h3>My Quizzes</h3>
            <p>View and continue editing your existing quizzes.</p>
            <span>View quizzes →</span>
          </div>

          <div
            className="dashboard-action-card"
            onClick={() => setPage("create")}
          >
            <h3>Create a Quiz</h3>
            <p>Start creating a brand-new quiz for your friends.</p>
            <span>Create quiz →</span>
          </div>
        </div>
        <Toast message={message} />
      </DashboardLayout>
    );
  }

  if (page === "create") {
    return (
      <div className="app">
        <DashboardLayout
          page={page}
          setPage={setPage}
          handleMyQuizzes={handleMyQuizzes}
          handleLogout={handleLogout}
        >
          <main className="create-page">
            <div className="create-card">
              <h2>Create Your Quiz</h2>
              <p>Start building a quiz and challenge your friends!</p>

              <input
                type="text"
                placeholder="Enter quiz title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                placeholder="Enter a short description"
                rows="4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>

              <button className="primary-btn" onClick={handleCreateQuiz}>
                Create Quiz
              </button>
            </div>
          </main>
          <Toast message={message} />
        </DashboardLayout>
      </div>
    );
  }

  if (page === "editor") {
    return (
      <div className="app">
        <DashboardLayout
          page={page}
          setPage={setPage}
          handleMyQuizzes={handleMyQuizzes}
          handleLogout={handleLogout}
        >
          <main className="editor-page">
            <div className="editor-card">
              <h2>Quiz Editor</h2>

              <p>Add questions to your quiz.</p>

              <div className="quiz-info">
                <h3>{title}</h3>
                <p>{description}</p>
                {quizCode && (
                  <p className="quiz-code-info">
                    Quiz Code: <strong>{quizCode}</strong>
                  </p>
                )}
              </div>

              <button
                className="secondary-btn manage-questions-btn"
                onClick={() => {
                  fetchQuestions(quizId);
                  setPage("questions");
                }}
              >
                Manage Questions ({questions.length})
              </button>

              {quizStatus === "waiting" && (
                <button
                  className="primary-btn waiting-room-direct-btn"
                  onClick={() => setPage("host-waiting-room")}
                >
                  🎯 Enter Waiting Room →
                </button>
              )}

              <button className="primary-btn" onClick={handleHostQuiz}>
                Host Quiz
              </button>

              <input
                type="text"
                placeholder="Enter your question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />

              <input
                type="text"
                placeholder="Option 1"
                value={option1}
                onChange={(e) => setOption1(e.target.value)}
              />

              <input
                type="text"
                placeholder="Option 2"
                value={option2}
                onChange={(e) => setOption2(e.target.value)}
              />

              <input
                type="text"
                placeholder="Option 3"
                value={option3}
                onChange={(e) => setOption3(e.target.value)}
              />

              <input
                type="text"
                placeholder="Option 4"
                value={option4}
                onChange={(e) => setOption4(e.target.value)}
              />

              <select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
              >
                <option value="">Select the correct answer</option>
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
                <option value="3">Option 3</option>
                <option value="4">Option 4</option>
              </select>

              <button className="primary-btn" onClick={handleAddQuestion}>
                {editingQuestion ? "Save Changes" : "+ Add Question"}
              </button>
            </div>
          </main>
          <Toast message={message} />
        </DashboardLayout>
      </div>
    );
  }

  if (page === "host-waiting-room") {
    return (
      <div className="app">
        <DashboardLayout
          page={page}
          setPage={setPage}
          handleMyQuizzes={handleMyQuizzes}
          handleLogout={handleLogout}
        >
          <HostWaitingRoom
            quizId={quizId}
            initialTitle={title}
            initialDescription={description}
            initialCode={quizCode}
            setPage={setPage}
            setQuizStatus={setQuizStatus}
          />
          <Toast message={message} />
        </DashboardLayout>
      </div>
    );
  }

  if (page === "quizzes") {
    return (
      <div className="app">
        <DashboardLayout
          page={page}
          setPage={setPage}
          handleMyQuizzes={handleMyQuizzes}
          handleLogout={handleLogout}
        >
          <main className="quizzes-page">
            <div className="quizzes-card">
              <h2>My Quizzes</h2>
              <p>Select a quiz to continue editing.</p>

              {quizzes.length === 0 ? (
                <p>No quizzes found. Create your first quiz!</p>
              ) : (
                <div className="quiz-list">
                  {quizzes.map((quiz) => (
                    <div
                      className="quiz-item"
                      key={quiz.id}
                      onClick={() => {
                        setQuizId(quiz.id);
                        setTitle(quiz.title);
                        setDescription(quiz.description);
                        setQuizCode(quiz.quizCode || "");
                        setQuizStatus(quiz.status || "draft");
                        fetchQuestions(quiz.id);
                        setPage("editor");
                      }}
                    >
                      <h3>{quiz.title}</h3>
                      <p>{quiz.description}</p>

                      <div className="quiz-item-footer">
                        <span className="edit-text">Click to edit →</span>
                        <span
                          className={`quiz-status ${quiz.status || "draft"}`}
                        >
                          {quiz.status === "waiting"
                            ? "🟡 Waiting"
                            : quiz.status === "live"
                              ? "🟢 Live"
                              : quiz.status === "finished"
                                ? "⚫ Finished"
                                : "📝 Draft"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
          <Toast message={message} />
        </DashboardLayout>
      </div>
    );
  }

  if (page === "questions") {
    return (
      <DashboardLayout
        page={page}
        setPage={setPage}
        handleMyQuizzes={handleMyQuizzes}
        handleLogout={handleLogout}
      >
        <div className="questions-page">
          <div className="page-header">
            <div>
              <h1>Manage Questions</h1>
              <p>
                {title} • {questions.length}{" "}
                {questions.length === 1 ? "Question" : "Questions"}
              </p>
            </div>

            <button className="secondary-btn" onClick={() => setPage("editor")}>
              ← Back to Quiz Editor
            </button>
          </div>

          <div className="question-search">
            <span className="search-icon">🔍</span>

            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchTerm && (
              <button
                className="clear-search"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>

          {searchTerm && (
            <p className="search-results">
              {filteredQuestions.length}{" "}
              {filteredQuestions.length === 1 ? "question" : "questions"} found
            </p>
          )}

          {questions.length === 0 ? (
            <div className="empty-questions">
              <h3>No questions yet</h3>
              <p>Add your first question from the Quiz Editor.</p>

              <button className="primary-btn" onClick={() => setPage("editor")}>
                + Add Question
              </button>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="no-search-results">
              <h3>No questions found</h3>
              <p>Try searching with a different word.</p>
            </div>
          ) : (
            <div className="questions-grid">
              {filteredQuestions.map((question, index) => (
                <div className="question-card" key={question.id}>
                  <div className="question-card-header">
                    <span className="question-number">
                      Question {index + 1}
                    </span>
                  </div>

                  <h3>{question.question}</h3>

                  <div className="question-options">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`question-option ${
                          optionIndex + 1 === question.correctAnswer
                            ? "correct-option"
                            : ""
                        }`}
                      >
                        <span>{optionIndex + 1}.</span>
                        {option}

                        {optionIndex + 1 === question.correctAnswer && (
                          <span className="correct-label">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="question-actions">
                    <button
                      className="edit-question-btn"
                      onClick={() => handleEditQuestion(question)}
                    >
                      ✏ Edit
                    </button>

                    <button
                      className="delete-question-btn"
                      onClick={() => handleDeleteQuestion(question)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {showDeleteDialog && (
          <div className="dialog-overlay">
            <div className="dialog-box">
              <h2>Delete Question?</h2>

              <p>
                Are you sure you want to delete this question? This action
                cannot be undone.
              </p>

              <div className="dialog-actions">
                <button
                  className="dialog-cancel-btn"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setQuestionToDelete(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  className="dialog-delete-btn"
                  onClick={confirmDeleteQuestion}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <Toast message={message} />
      </DashboardLayout>
    );
  }
}

export default App;
