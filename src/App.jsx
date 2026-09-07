import { useState, useEffect, useMemo, useRef } from "react";

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

import {
  ref as rtdbRef,
  onValue as rtdbOnValue,
  set as rtdbSet,
  remove as rtdbRemove,
  get as rtdbGet,
  onDisconnect as rtdbOnDisconnect,
  push as rtdbPush,
  onChildAdded as rtdbOnChildAdded,
} from "firebase/database";

import { db, auth, rtdb } from "./services/firebase";

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

const EMOJI_UNICODE_RANGES = [
  [0x1f600, 0x1f637], // Smileys & emoticons
  [0x1f638, 0x1f640], // Cat expressions
  [0x1f648, 0x1f64a], // Monkeys
  [0x1f400, 0x1f43c], // Animals
  [0x1f980, 0x1f997], // Wildlife & creatures
  [0x1f910, 0x1f92f], // Expressive faces
  [0x1f331, 0x1f343], // Nature & plants
  [0x1f345, 0x1f37f], // Food & drink
  [0x1f3a0, 0x1f3c4], // Activities & sports
  [0x1f680, 0x1f6c0], // Transport & space
];

const generateDynamicAvatar = (existingAvatars = new Set()) => {
  const MAX_ATTEMPTS = 500;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const range =
      EMOJI_UNICODE_RANGES[
        Math.floor(Math.random() * EMOJI_UNICODE_RANGES.length)
      ];
    const codePoint =
      Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    const candidate = String.fromCodePoint(codePoint);

    if (!existingAvatars.has(candidate)) {
      return candidate;
    }
  }

  // If initial random attempts hit taken avatars, scan available ranges
  for (const [start, end] of EMOJI_UNICODE_RANGES) {
    for (let cp = start; cp <= end; cp++) {
      const candidate = String.fromCodePoint(cp);
      if (!existingAvatars.has(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to generate a unique avatar for this lobby.");
};

function JoinQuizScreen({ selectedQuiz, onBack, onJoined }) {
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

      // Fetch participant documents from Firestore
      const participantsSnapshot = await getDocs(
        collection(db, "quizzes", selectedQuiz.id, "participants"),
      );

      // Determine currently active participant IDs from RTDB so stale docs do not block avatars
      const activeParticipantIds = new Set();
      try {
        const presenceSnap = await rtdbGet(
          rtdbRef(rtdb, `presence/${selectedQuiz.id}`),
        );
        if (presenceSnap.exists()) {
          const presenceData = presenceSnap.val() || {};
          Object.keys(presenceData).forEach((pid) => {
            if (
              presenceData[pid] === true ||
              presenceData[pid]?.state === "online"
            ) {
              activeParticipantIds.add(pid);
            }
          });
        }
      } catch (rtdbErr) {
        console.warn(
          "Could not read RTDB presence for avatar occupancy, falling back to Firestore only:",
          rtdbErr,
        );
        participantsSnapshot.docs.forEach((doc) =>
          activeParticipantIds.add(doc.id),
        );
      }

      // Only avatars belonging to currently active participants are considered occupied
      const existingAvatars = new Set(
        participantsSnapshot.docs
          .filter((doc) => activeParticipantIds.has(doc.id))
          .map((doc) => doc.data().avatar)
          .filter(Boolean),
      );

      const avatar = generateDynamicAvatar(existingAvatars);

      // Register temporary participant presence in the quiz's participants subcollection
      const participantRef = await addDoc(
        collection(db, "quizzes", selectedQuiz.id, "participants"),
        {
          name: trimmedName,
          avatar,
          joinedAt: new Date(),
        },
      );

      if (onJoined) {
        onJoined({
          quizId: selectedQuiz.id,
          quizTitle: selectedQuiz.title || quizData.title,
          participantId: participantRef.id,
          participantName: trimmedName,
          participantAvatar: avatar,
        });
      }
    } catch (err) {
      console.error(
        "Error verifying quiz code or registering participant:",
        err,
      );
      showMessage(
        "Something went wrong while joining the quiz. Please try again.",
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

// Deterministic 32-bit FNV-1a hash
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Supported live reaction emojis
const REACTION_EMOJIS = ["👍", "🔥", "😂", "😮", "👏"];

// Ephemeral lobby reaction sender with owner-based cleanup
async function sendLobbyReaction(quizId, participantId, emoji) {
  if (!quizId || !participantId || !emoji) return;

  try {
    // 1. Create the unique reaction reference using push()
    const reactionsRef = rtdbRef(rtdb, `reactions/${quizId}`);
    const reactionRef = rtdbPush(reactionsRef);

    // 2. Register disconnect cleanup BEFORE writing
    await rtdbOnDisconnect(reactionRef).remove();

    // 3. Write the reaction
    await rtdbSet(reactionRef, {
      emoji,
      participantId,
      createdAt: Date.now(),
    });

    // 4. Normal cleanup scheduled after ~4 seconds
    setTimeout(async () => {
      try {
        await rtdbOnDisconnect(reactionRef)
          .cancel()
          .catch(() => {});
        await rtdbRemove(reactionRef).catch(() => {});
      } catch {
        // safely handle cleanup failures
      }
    }, 4000);
  } catch (err) {
    console.error("Error sending lobby reaction:", err);
  }
}

function ParticipantReactionBar({ quizId, participantId }) {
  const [isCooldown, setIsCooldown] = useState(false);
  const cooldownTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleSend = (emoji) => {
    if (isCooldown || !quizId || !participantId) return;

    // Trigger instant reaction send
    sendLobbyReaction(quizId, participantId, emoji);

    // Enter 2-second cooldown
    setIsCooldown(true);
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      setIsCooldown(false);
    }, 2000);
  };

  return (
    <div className="lobby-reaction-bar-container">
      <div className="lobby-reaction-bar-label">Send Reaction</div>
      <div
        className={`lobby-reaction-bar ${isCooldown ? "is-cooling" : ""}`}
        role="group"
        aria-label="Reaction buttons"
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="reaction-btn"
            onClick={() => handleSend(emoji)}
            disabled={isCooldown}
            title={isCooldown ? "Please wait 2 seconds..." : `Send ${emoji}`}
            aria-label={`Send ${emoji} reaction`}
          >
            <span className="reaction-emoji">{emoji}</span>
          </button>
        ))}

        {/* Subtle cooldown progress indicator */}
        <div className="reaction-cooldown-track" aria-hidden="true">
          <div className="reaction-cooldown-fill" />
        </div>
      </div>
      {isCooldown && (
        <span className="reaction-cooldown-hint" aria-live="polite">
          Wait 2s...
        </span>
      )}
    </div>
  );
}

function LobbyReactionsOverlay({ quizId }) {
  const [reactions, setReactions] = useState([]);
  const timersRef = useRef(new Set());

  useEffect(() => {
    if (!quizId) return;

    const currentTimers = timersRef.current;
    const reactionsRef = rtdbRef(rtdb, `reactions/${quizId}`);

    // Listen to individual reaction events using onChildAdded
    const unsubscribe = rtdbOnChildAdded(
      reactionsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.emoji) return;

        const now = Date.now();
        const createdAt =
          typeof data.createdAt === "number" ? data.createdAt : now;

        // ⏳ Stale Reaction Protection: ignore if older than 6000ms
        if (now - createdAt > 6000) {
          return;
        }

        const reactionId = snapshot.key;
        const seed = reactionId || String(now + Math.random());

        // Derive varied organic animation parameters using stable hash of seed
        const startX = 12 + (hashString(seed + "_x") % 77); // 12% to 88%
        const driftX = (hashString(seed + "_drift") % 51) - 25; // -25px to +25px
        const variant = (hashString(seed + "_var") % 3) + 1; // 1, 2, or 3
        const duration = parseFloat(
          (2.7 + (hashString(seed + "_dur") % 8) / 10).toFixed(2),
        ); // 2.7s to 3.4s
        const scale = parseFloat(
          (0.95 + (hashString(seed + "_scl") % 25) / 100).toFixed(2),
        ); // 0.95 to 1.20
        const rot = (hashString(seed + "_rot") % 25) - 12; // -12deg to +12deg

        const newReaction = {
          id: reactionId,
          emoji: data.emoji,
          startX,
          driftX,
          variant,
          duration,
          scale,
          rot,
        };

        setReactions((prev) => {
          if (prev.some((r) => r.id === reactionId)) return prev;
          return [...prev, newReaction];
        });

        // Remove from local UI state after approximately 3.2 seconds
        const timerId = setTimeout(() => {
          currentTimers.delete(timerId);
          setReactions((prev) => prev.filter((r) => r.id !== reactionId));
        }, 3200);

        currentTimers.add(timerId);
      },
      (err) => {
        console.error("Error listening to lobby reactions:", err);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
      currentTimers.forEach((t) => clearTimeout(t));
      currentTimers.clear();
    };
  }, [quizId]);

  if (reactions.length === 0) return null;

  return (
    <div className="lobby-reactions-overlay" aria-hidden="true">
      {reactions.map((r) => (
        <div
          key={r.id}
          className={`floating-reaction variant-${r.variant}`}
          style={{
            left: `${r.startX}%`,
            "--drift-x": `${r.driftX}px`,
            "--reaction-scale": r.scale,
            "--reaction-rot": `${r.rot}deg`,
            animationDuration: `${r.duration}s`,
          }}
        >
          <span className="floating-reaction-emoji">{r.emoji}</span>
        </div>
      ))}
    </div>
  );
}

function ParticipantLobby({
  quizId,
  initialTitle,
  participantId,
  participantName,
  initialAvatar,
  onLeave,
}) {
  const [participants, setParticipants] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [quizData, setQuizData] = useState({
    title: initialTitle || "Quiz Lobby",
    status: "waiting",
  });
  const [loading, setLoading] = useState(Boolean(quizId));
  const [error, setError] = useState(quizId ? "" : "No quiz selected.");
  const [isLeaving, setIsLeaving] = useState(false);

  // Active participants: Firestore docs filtered by RTDB presence === 'online'
  const activeParticipants = useMemo(() => {
    return participants.filter((p) => {
      const pres = presenceMap[p.id];
      return pres && (pres === true || pres.state === "online");
    });
  }, [participants, presenceMap]);

  const participantsCount = activeParticipants.length;

  // 1. Manage participant RTDB presence with onDisconnect() and reconnection handling
  useEffect(() => {
    if (!quizId || !participantId) {
      return;
    }

    const presenceRef = rtdbRef(rtdb, `presence/${quizId}/${participantId}`);
    const connectedRef = rtdbRef(rtdb, ".info/connected");

    const unsubConnected = rtdbOnValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        try {
          // Requirement 3: Register onDisconnect().remove() BEFORE setting online
          await rtdbOnDisconnect(presenceRef).remove();

          // Requirement 4: Set online only after onDisconnect registration succeeds
          await rtdbSet(presenceRef, {
            state: "online",
            joinedAt: Date.now(),
          });
        } catch (err) {
          console.error("Error establishing RTDB presence:", err);
        }
      }
    });

    return () => {
      unsubConnected();
    };
  }, [quizId, participantId]);

  // 2. Listen to RTDB presence for this quiz in real time
  useEffect(() => {
    if (!quizId) {
      return;
    }

    const quizPresenceRef = rtdbRef(rtdb, `presence/${quizId}`);
    const unsubPresence = rtdbOnValue(
      quizPresenceRef,
      (snapshot) => {
        const val = snapshot.val();
        setPresenceMap(val || {});
      },
      (err) => {
        console.error("Error listening to RTDB presence in lobby:", err);
      },
    );

    return () => {
      unsubPresence();
    };
  }, [quizId]);

  // 3. Listen to Firestore quiz details & participant documents
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
          setQuizData({
            title: data.title || initialTitle || "Quiz Lobby",
            status: data.status || "waiting",
          });
          setLoading(false);
        } else {
          setError("This quiz is no longer available.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error listening to quiz doc in lobby:", err);
        setError("Failed to load quiz details.");
        setLoading(false);
      },
    );

    const participantsRef = collection(db, "quizzes", quizId, "participants");
    const unsubParticipants = onSnapshot(
      participantsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Anonymous",
          avatar: d.data().avatar || "",
          joinedAt: d.data().joinedAt,
        }));
        setParticipants(list);
      },
      (err) => {
        console.error("Error listening to participants in lobby:", err);
      },
    );

    const handleBeforeUnload = () => {
      // Best-effort optimization only. Not required for correctness.
      if (participantId && quizId) {
        deleteDoc(
          doc(db, "quizzes", quizId, "participants", participantId),
        ).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubQuiz();
      unsubParticipants();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [quizId, participantId, initialTitle]);

  // 4. Duplicate avatar resolution among ACTIVE participants only
  useEffect(() => {
    const myDoc = activeParticipants.find((p) => p.id === participantId);
    if (!myDoc || !myDoc.avatar) return;

    const duplicates = activeParticipants.filter(
      (p) => p.avatar === myDoc.avatar,
    );
    if (duplicates.length > 1) {
      const sorted = [...duplicates].sort((a, b) => {
        const timeA = a.joinedAt?.toMillis
          ? a.joinedAt.toMillis()
          : a.joinedAt
            ? new Date(a.joinedAt).getTime()
            : 0;
        const timeB = b.joinedAt?.toMillis
          ? b.joinedAt.toMillis()
          : b.joinedAt
            ? new Date(b.joinedAt).getTime()
            : 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      if (sorted[0].id !== participantId) {
        const allUsed = new Set(
          activeParticipants.map((p) => p.avatar).filter(Boolean),
        );
        try {
          const freshAvatar = generateDynamicAvatar(allUsed);
          updateDoc(doc(db, "quizzes", quizId, "participants", participantId), {
            avatar: freshAvatar,
          }).catch((err) => {
            console.error("Error resolving avatar collision:", err);
          });
        } catch (err) {
          console.error("Error generating fresh avatar on collision:", err);
        }
      }
    }
  }, [activeParticipants, participantId, quizId]);

  // 5. Explicit Leave handler: cancel onDisconnect, remove RTDB presence, delete Firestore doc
  const handleLeaveLobby = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      if (participantId && quizId) {
        const presenceRef = rtdbRef(
          rtdb,
          `presence/${quizId}/${participantId}`,
        );
        try {
          await rtdbOnDisconnect(presenceRef).cancel();
        } catch {
          // ignore if already disconnected
        }
        try {
          await rtdbRemove(presenceRef);
        } catch (e) {
          console.error("Error removing RTDB presence on leave:", e);
        }

        await deleteDoc(
          doc(db, "quizzes", quizId, "participants", participantId),
        );
      }
    } catch (err) {
      console.error("Error leaving lobby:", err);
    } finally {
      setIsLeaving(false);
      onLeave();
    }
  };

  const myDoc =
    activeParticipants.find((p) => p.id === participantId) ||
    participants.find((p) => p.id === participantId);
  const myAvatar = myDoc?.avatar || initialAvatar || "";

  if (loading) {
    return (
      <div className="participant-lobby-page">
        <div className="participant-lobby-card">
          <div className="role-logo">QuizMeter</div>
          <h2>Connecting to Lobby...</h2>
          <p className="lobby-loading-text">
            Joining {initialTitle || "quiz"}...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="participant-lobby-page">
        <div className="participant-lobby-card">
          <div className="role-logo">QuizMeter</div>
          <h2>Quiz Unavailable</h2>
          <p className="lobby-error-text">{error}</p>
          <button
            type="button"
            className="primary-btn lobby-back-btn"
            onClick={handleLeaveLobby}
          >
            ← Back to Live Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-lobby-page">
      <LobbyReactionsOverlay quizId={quizId} />
      <header className="participant-lobby-header">
        <div className="participant-logo">QuizMeter</div>
        <button
          type="button"
          className="secondary-btn lobby-top-leave-btn"
          onClick={handleLeaveLobby}
          disabled={isLeaving}
        >
          {isLeaving ? "Leaving..." : "← Leave Quiz"}
        </button>
      </header>

      <main className="participant-lobby-main">
        <div className="participant-lobby-card">
          <div className="lobby-status-badge-wrap">
            <span className={`quiz-status ${quizData.status}`}>
              {quizData.status === "waiting"
                ? "🟡 Waiting for Host"
                : quizData.status === "live"
                  ? "🟢 Quiz is Live"
                  : quizData.status === "finished"
                    ? "⚫ Finished"
                    : "📝 Draft"}
            </span>
          </div>

          <h1 className="lobby-quiz-title">{quizData.title}</h1>

          <div className="lobby-participant-info">
            {myAvatar && (
              <span className="lobby-participant-avatar">{myAvatar}</span>
            )}
            <span className="lobby-participant-label">You joined as:</span>
            <span className="lobby-participant-name">{participantName}</span>
          </div>

          <div className="lobby-counter-card">
            <div className="lobby-counter-number">{participantsCount}</div>
            <div className="lobby-counter-label">
              {participantsCount === 1
                ? "Participant in Lobby"
                : "Participants in Lobby"}
            </div>
          </div>

          <ParticipantReactionBar
            quizId={quizId}
            participantId={participantId}
          />

          {quizData.status === "waiting" && (
            <div className="lobby-message-card waiting-state">
              <div className="lobby-message-icon">⏳</div>
              <h3>Waiting for the host to start the quiz...</h3>
              <p>
                You are in! As soon as the host starts the quiz, questions will
                appear here.
              </p>
            </div>
          )}

          {quizData.status === "live" && (
            <div className="lobby-message-card live-state">
              <div className="lobby-message-icon">🚀</div>
              <h3>Quiz is starting!</h3>
              <p>The host has started the quiz. Please get ready!</p>
            </div>
          )}

          {quizData.status === "finished" && (
            <div className="lobby-message-card finished-state">
              <div className="lobby-message-icon">⚫</div>
              <h3>This quiz has finished</h3>
              <p>The host has ended this quiz session.</p>
              <button
                type="button"
                className="primary-btn"
                onClick={handleLeaveLobby}
              >
                Back to Live Quizzes
              </button>
            </div>
          )}

          <div className="lobby-footer-action">
            <button
              type="button"
              className="lobby-exit-link"
              onClick={handleLeaveLobby}
              disabled={isLeaving}
            >
              Leave Lobby
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ParticipantLiveQuizzes({ onBack }) {
  const [liveQuizzes, setLiveQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [joinedSession, setJoinedSession] = useState(null);

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

  if (joinedSession) {
    return (
      <ParticipantLobby
        quizId={joinedSession.quizId}
        initialTitle={joinedSession.quizTitle}
        participantId={joinedSession.participantId}
        participantName={joinedSession.participantName}
        initialAvatar={joinedSession.participantAvatar}
        onLeave={() => {
          setJoinedSession(null);
          setSelectedQuiz(null);
        }}
      />
    );
  }

  if (selectedQuiz) {
    return (
      <JoinQuizScreen
        selectedQuiz={selectedQuiz}
        onBack={() => setSelectedQuiz(null)}
        onJoined={(session) => setJoinedSession(session)}
      />
    );
  }

  if (selectedQuiz) {
    return (
      <JoinQuizScreen
        selectedQuiz={selectedQuiz}
        onBack={() => setSelectedQuiz(null)}
        onJoined={(session) => setJoinedSession(session)}
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

// Generate organic position strictly from participantId as the primary stable seed
function getStableParticipantPosition(participantId, attempt = 0) {
  const seed =
    attempt === 0 ? participantId : `${participantId}_step${attempt}`;
  const hAngle = hashString(seed + "_angle");
  const hRadius = hashString(seed + "_radius");
  const hJitterX = hashString(seed + "_jx");
  const hJitterY = hashString(seed + "_jy");

  // Angle in radians distributed around 360 degrees
  const angle = ((hAngle % 3600) / 3600) * 2 * Math.PI;

  // Natural outward growth rings by attempt:
  // Initial attempt clusters near center; subsequent attempts expand outward
  const baseRadius = 5 + Math.min(attempt * 6, 32);
  const spread = 9;
  const rawR = (hRadius % 1000) / 1000;
  const radius = baseRadius + Math.sqrt(rawR) * spread;

  // Organic jitter offsets (-2% to +2%)
  const jitterX = ((hJitterX % 40) - 20) / 10;
  const jitterY = ((hJitterY % 40) - 20) / 10;

  // Center is at (50%, 50%). Proportions adapted to stage
  let x = 50 + radius * 1.35 * Math.cos(angle) + jitterX;
  let y = 50 + radius * 0.95 * Math.sin(angle) + jitterY;

  // Clamp within bounds with safe margins
  x = Math.max(6, Math.min(94, x));
  y = Math.max(8, Math.min(92, y));

  // Multi-point organic local drift parameters derived strictly from participantId
  const hAnim = hashString(participantId + "_anim");
  const hDuration = hashString(participantId + "_dur");
  const hDelay = hashString(participantId + "_del");
  const hScale = hashString(participantId + "_scl");

  // Pick one of 4 organic multi-point drift paths (1 to 4)
  const animVariant = (hAnim % 4) + 1;
  // Slow, calm duration between 5.5s and 8.8s
  const duration = 5.5 + (hDuration % 34) / 10;
  // Non-synchronized starting phase/delay (already mid-flight)
  const delay = -((hDelay % 90) / 10);
  // Subtle drift intensity multiplier (0.85 to 1.15) for natural organic variance
  const driftScale = Number(((85 + (hScale % 31)) / 100).toFixed(2));

  return { x, y, animVariant, duration, delay, driftScale };
}

function ParticipantAvatarCluster({ activeParticipants, quizId }) {
  // Store persistent positions mapped by participantId so existing avatars never jump/reshuffle
  const [positionsCache] = useState(() => new Map());
  const [renderItems, setRenderItems] = useState([]);
  const [exitTimers] = useState(() => new Map());

  useEffect(() => {
    // 1. Build a lookup of current active participant objects by ID
    const activeMap = new Map();
    activeParticipants.forEach((p) => {
      activeMap.set(p.id, p);
    });

    // 2. Ensure every active participant has a stable position in cache
    activeParticipants.forEach((p) => {
      if (!positionsCache.has(p.id)) {
        let bestPos = getStableParticipantPosition(p.id, 0);
        let bestMinDist = 0;

        // Deterministic collision avoidance using participantId iterations
        for (let attempt = 0; attempt < 8; attempt++) {
          const cand = getStableParticipantPosition(p.id, attempt);
          let minDist = Infinity;
          for (const [otherId, otherPos] of positionsCache.entries()) {
            if (otherId === p.id) continue;
            const dx = cand.x - otherPos.x;
            const dy = (cand.y - otherPos.y) * 1.3;
            const d = Math.hypot(dx, dy);
            if (d < minDist) minDist = d;
          }

          if (minDist > 10) {
            bestPos = cand;
            break;
          }
          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            bestPos = cand;
          }
        }

        positionsCache.set(p.id, bestPos);
      }
    });

    // 3. Update renderItems with enter/active/leave lifecycle
    const frameId = requestAnimationFrame(() => {
      setRenderItems((prevItems) => {
        const prevMap = new Map(prevItems.map((item) => [item.id, item]));
        const nextItems = [];

        // A. Keep or add active participants
        const isSingle = activeParticipants.length === 1;

        activeParticipants.forEach((p) => {
          const deterministicPos =
            positionsCache.get(p.id) || getStableParticipantPosition(p.id, 0);
          const pos = isSingle
            ? { ...deterministicPos, x: 50, y: 50 }
            : deterministicPos;
          const existing = prevMap.get(p.id);

          // Cancel any pending exit timer if reconnected
          if (exitTimers.has(p.id)) {
            clearTimeout(exitTimers.get(p.id));
            exitTimers.delete(p.id);
          }

          if (existing) {
            nextItems.push({
              ...existing,
              x: pos.x,
              y: pos.y,
              name: p.name,
              avatar: p.avatar,
              status: "active",
            });
          } else {
            // New participant entering
            nextItems.push({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              x: pos.x,
              y: pos.y,
              animVariant: pos.animVariant,
              duration: pos.duration,
              delay: pos.delay,
              driftScale: pos.driftScale,
              status: "entering",
            });
          }
        });

        // B. Identify leaving participants (in prevItems but no longer in activeParticipants)
        prevItems.forEach((item) => {
          if (!activeMap.has(item.id)) {
            if (item.status !== "leaving") {
              nextItems.push({
                ...item,
                status: "leaving",
              });

              // Set timer to cleanly remove after exit animation finishes (400ms)
              const timerId = setTimeout(() => {
                positionsCache.delete(item.id);
                exitTimers.delete(item.id);
                setRenderItems((curr) => curr.filter((c) => c.id !== item.id));
              }, 400);

              exitTimers.set(item.id, timerId);
            } else {
              // Already leaving, keep until timer removes it
              nextItems.push(item);
            }
          }
        });

        return nextItems;
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeParticipants, positionsCache, exitTimers]);

  // Promote 'entering' items to 'active' on next animation frame
  useEffect(() => {
    const hasEntering = renderItems.some((it) => it.status === "entering");
    if (hasEntering) {
      const animFrame = requestAnimationFrame(() => {
        setRenderItems((curr) =>
          curr.map((it) =>
            it.status === "entering" ? { ...it, status: "active" } : it,
          ),
        );
      });
      return () => cancelAnimationFrame(animFrame);
    }
  }, [renderItems]);

  const count = activeParticipants.length;

  return (
    <div className="avatar-cluster-section">
      {count > 0 && (
        <div className="avatar-cluster-header">
          <div className="cluster-header-count">
            {count === 1
              ? "1 participant joined"
              : `${count} participants joined`}
          </div>
        </div>
      )}

      <div className="avatar-cluster-stage">
        {count === 0 && renderItems.length === 0 ? (
          <div className="cluster-empty-state">
            <div className="cluster-radar-pulse">
              <span className="radar-ring r1"></span>
              <span className="radar-ring r2"></span>
              <span className="radar-icon">👥</span>
            </div>
            <p className="cluster-empty-title">
              Waiting for participants to join...
            </p>
            <span className="cluster-empty-hint">
              Share the quiz code above to let participants enter the room
            </span>
          </div>
        ) : (
          renderItems.map((item) => (
            <div
              key={item.id}
              className={`avatar-cluster-node ${item.status}`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
              }}
              title={item.name}
            >
              <div
                className={`avatar-floating-wrapper drift-v${item.animVariant || 1}`}
                style={{
                  animationDuration: `${item.duration}s`,
                  animationDelay: `${item.delay}s`,
                  "--drift-intensity": item.driftScale || 1,
                }}
              >
                <div className="avatar-bubble">
                  <span className="avatar-emoji">{item.avatar || "👤"}</span>
                </div>
              </div>
            </div>
          ))
        )}
        <LobbyReactionsOverlay quizId={quizId} />
      </div>
    </div>
  );
}

function HostWaitingRoom({
  quizId,
  initialTitle,
  initialDescription,
  initialCode,
  setPage,
  setQuizStatus,
}) {
  const [participants, setParticipants] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [quizData, setQuizData] = useState({
    title: initialTitle,
    description: initialDescription,
    quizCode: initialCode,
    status: "waiting",
  });
  const [loading, setLoading] = useState(Boolean(quizId));
  const [error, setError] = useState(quizId ? "" : "No quiz selected.");
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  // Active participants: Firestore docs filtered by RTDB presence === 'online'
  const activeParticipants = useMemo(() => {
    return participants.filter((p) => {
      const pres = presenceMap[p.id];
      return pres && (pres === true || pres.state === "online");
    });
  }, [participants, presenceMap]);

  // Real-time listener for active participants in RTDB
  useEffect(() => {
    if (!quizId) {
      return;
    }

    const presenceRef = rtdbRef(rtdb, `presence/${quizId}`);
    const unsubPresence = rtdbOnValue(
      presenceRef,
      (snapshot) => {
        const val = snapshot.val();
        setPresenceMap(val || {});
      },
      (err) => {
        console.error(
          "Error listening to RTDB presence in host waiting room:",
          err,
        );
      },
    );

    return () => {
      unsubPresence();
    };
  }, [quizId]);

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

    if (activeParticipants.length === 0) {
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

      <div className="waiting-room-header">
        <h1>{quizData.title}</h1>
        {quizData.description && <p>{quizData.description}</p>}
      </div>

      <div className="waiting-room-code-bar">
        <span className="code-label">QUIZ CODE:</span>
        <span className="code-value">{quizData.quizCode || "------"}</span>
        <button className="copy-code-btn" onClick={handleCopyCode}>
          {copied ? "✓ Copied" : "📋 Copy Code"}
        </button>
      </div>

      <ParticipantAvatarCluster
        activeParticipants={activeParticipants}
        quizId={quizId}
      />

      <div className="waiting-room-actions">
        <button
          className={`primary-btn start-quiz-btn ${
            quizData.status === "live" ? "is-live" : ""
          }`}
          onClick={handleStartQuiz}
          disabled={
            isStarting ||
            quizData.status !== "waiting" ||
            activeParticipants.length === 0
          }
          title={
            activeParticipants.length === 0
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

        {quizData.status === "waiting" && activeParticipants.length === 0 && (
          <p className="waiting-participant-hint">
            Waiting for at least one participant...
          </p>
        )}
      </div>

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
