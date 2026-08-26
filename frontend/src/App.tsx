import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import CampusMap from "./components/CampusMap";
import CampusLayout from "./components/CampusLayout";
import type { CampusPlace } from "./components/CampusLayout";
import "./App.css";

type Kind = "LOST" | "FOUND" | "LAST_SEEN";

type Location = {
  building?: string | null;
  latitude?: number;
  longitude?: number;
  zone?: string;
};

type Report = {
  id: string;
  itemName: string;
  category: string;
  description: string;
  reportType: Kind;
  date: string;
  imageUrl?: string | null;
  location?: Location;
  status?: "ACTIVE" | "RECOVERED";
  user?: { id: string; name: string; department: string };
};

type PossibleMatch = {
  source: Report;
  report: Report;
  score: number;
  reasons: string[];
  distance: number;
};

type ChatRequest = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  report: { itemName: string };
  requester: { id: string; name: string };
  owner: { id: string; name: string };
};

type ChatMessage = { id: string; content: string; sender: { id: string; name: string }; createdAt: string };

const API =
  import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const label: Record<Kind, string> = {
  LOST: "Lost",
  FOUND: "Found",
  LAST_SEEN: "Last seen",
};

const coverageZone = (location: { lat: number; lng: number }) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const campus = { lat: 17.5449, lng: 78.5718 };
  const latitudeDifference = toRadians(location.lat - campus.lat);
  const longitudeDifference = toRadians(location.lng - campus.lng);
  const value = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(toRadians(campus.lat)) * Math.cos(toRadians(location.lat)) * Math.sin(longitudeDifference / 2) ** 2;
  const distance = 2 * 6_371_000 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  if (distance <= 1_200) return { name: "Inside campus zone", className: "campus", detail: "This location is within the MRDU campus area." };
  if (distance <= 3_500) return { name: "Near-campus zone", className: "near-campus", detail: "This location is close to campus and can be reported." };
  return { name: "Outside coverage area", className: "outside", detail: "Choose a location within campus or the nearby campus area." };
};

function App() {
  const [page, setPage] = useState<
    "home" | "browse" | "campus" | "report" | "account" | "messages" | "detail"
  >("home");

  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"ALL" | Kind>("ALL");

  const [token, setToken] = useState(() =>
    localStorage.getItem("campusfind-token") ?? ""
  );
  const [userId, setUserId] = useState(() => localStorage.getItem("campusfind-user-id") ?? "");
  const [profile, setProfile] = useState<{ name: string; email: string; studentId: string; department: string; year: number } | null>(() => { const saved = localStorage.getItem("campusfind-profile"); return saved ? JSON.parse(saved) : null; });
  const [chatRequests, setChatRequests] = useState<{ received: ChatRequest[]; sent: ChatRequest[] }>({ received: [], sent: [] });
  const [possibleMatches, setPossibleMatches] = useState<PossibleMatch[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRequest | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [message, setMessage] = useState("");
  const [register, setRegister] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState({
    lat: 17.5449,
    lng: 78.5718,
  });
  const [building, setBuilding] = useState("");

  const selectCampusPlace = (place: CampusPlace) => {
    setBuilding(place.name);
    setSelectedLocation({ lat: place.latitude, lng: place.longitude });
    setMessage(`${place.name} selected. You can add more detail on the report form.`);
    reportPage();
  };

  /*
   * Load reports
   */
  useEffect(() => {
    fetch(`${API}/reports`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load reports");
        }

        return response.json();
      })
      .then((data: { reports: Report[] }) => {
        setReports(data.reports ?? []);
      })
      .catch((error) => {
        console.error("Reports loading error:", error);
      });
  }, []);

  async function loadChatRequests() {
    if (!token) return;
    const response = await fetch(`${API}/chats/requests`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const data = await response.json() as { received: ChatRequest[]; sent: ChatRequest[] };
    setChatRequests({ received: data.received, sent: data.sent });
  }

  async function loadPossibleMatches() {
    if (!token) return;
    const response = await fetch(`${API}/reports/matches`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const data = await response.json() as { matches: PossibleMatch[] };
    setPossibleMatches(data.matches ?? []);
  }

  function openAccount() {
    setPage("account");
    void loadChatRequests();
    void loadPossibleMatches();
  }

  function openReport(report: Report) {
    setSelectedReport(report);
    setPage("detail");
  }

  /*
   * Search and filter
   */
  const shown = useMemo(() => {
    return reports.filter((report) => {
      const matchesKind =
        kind === "ALL" || report.reportType === kind;

      const text =
        `${report.itemName} ${report.category} ${report.description}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      return matchesKind && matchesSearch;
    });
  }, [reports, kind, search]);

  /*
   * Open report page
   */
  const reportPage = () => {
    if (token) {
      setPage("report");
    } else {
      setMessage("Please log in before submitting a report.");
      setPage("account");
    }
  };

  /*
   * Login / Register
   */
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);

      const payload = Object.fromEntries(formData);

      const response = await fetch(
        `${API}/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json().catch(() => ({
        message: "Could not reach the server.",
      }))) as {
        token?: string;
        message?: string;
        user?: { id: string; name: string; email: string; studentId: string; department: string; year: number };
      };

      if (!response.ok || !data.token) {
        setMessage(data.message ?? "Login failed.");
        return;
      }

      localStorage.setItem("campusfind-token", data.token);

      if (data.user) {
        localStorage.setItem("campusfind-user-id", data.user.id);
        const { id: _id, ...savedProfile } = data.user;
        localStorage.setItem("campusfind-profile", JSON.stringify(savedProfile));
        setUserId(data.user.id);
        setProfile(savedProfile);
      }

      setToken(data.token);

      setMessage(
        register
          ? "Account created successfully."
          : "Login successful."
      );

      setPage("home");
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to the backend. Make sure your backend server is running."
      );
    }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const response = await fetch(`${API}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json() as { message: string };
    setResetEmail(email); setResetOtpSent(response.ok); setMessage(data.message);
  }

  async function confirmPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`${API}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resetEmail, code: form.get("code"), password: form.get("password") }) });
    const data = await response.json() as { message: string };
    setMessage(data.message);
    if (response.ok) { setForgotPassword(false); setResetOtpSent(false); }
  }

  /*
   * Create report
   */
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    if (!token) {
      setMessage("Please log in first.");
      setPage("account");
      return;
    }

    try {
      const formData = new FormData(event.currentTarget);
      const imageFile = formData.get("image");
      let imageUrl: string | undefined;

      if (imageFile instanceof File && imageFile.size > 0) {
        if (!imageFile.type.startsWith("image/") || imageFile.size > 3_000_000) {
          setMessage("Please choose an image smaller than 3 MB.");
          return;
        }
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the selected image."));
          reader.readAsDataURL(imageFile);
        });
      }

      const payload = {
        itemName: formData.get("itemName"),
        category: formData.get("category"),
        description: formData.get("description"),
        reportType: formData.get("reportType"),
        date: formData.get("date"),
        imageUrl,

        location: {
          building: formData.get("building"),
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
        },
      };

      const response = await fetch(`${API}/reports`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({
        message: "Could not reach the server.",
      }))) as {
        report?: Report;
        message?: string;
      };

      /*
       * Token expired / invalid
       */
      if (response.status === 401) {
        localStorage.removeItem("campusfind-token");
        setToken("");

        setMessage(
          "Your login session expired. Please log in again."
        );

        setPage("account");

        return;
      }

      if (!response.ok || !data.report) {
        setMessage(data.message ?? "Could not publish report.");
        return;
      }

      setReports((oldReports) => [
        data.report!,
        ...oldReports,
      ]);

      setMessage("Your report has been published.");

      setPage("browse");
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to the backend. Make sure your backend server is running."
      );
    }
  }

  async function requestPrivateChat(report: Report) {
    if (!token) { setMessage("Please log in to request a private chat."); setPage("account"); return; }
    const response = await fetch(`${API}/reports/${report.id}/chat-requests`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({ message: "Could not send the chat request." })) as { message: string };
    setMessage(data.message);
    if (response.ok) {
      void loadChatRequests();
      setPage("account");
    }
  }

  async function respondToChat(chatRequest: ChatRequest, action: "accept" | "decline") {
    const response = await fetch(`${API}/chats/requests/${chatRequest.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({ message: "Could not update the request." })) as { message: string };
    setMessage(data.message);
    if (response.ok) void loadChatRequests();
  }

  async function openChat(chatRequest: ChatRequest) {
    const response = await fetch(`${API}/chats/${chatRequest.id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({ messages: [] })) as { messages: ChatMessage[] };
    if (!response.ok) { setMessage("This private chat is not available."); return; }
    setActiveChat(chatRequest); setChatMessages(data.messages);
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeChat) return;
    const form = event.currentTarget;
    const content = String(new FormData(form).get("message") ?? "").trim();
    if (!content) return;
    const response = await fetch(`${API}/chats/${activeChat.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content }) });
    const data = await response.json().catch(() => null) as { message?: ChatMessage } | null;
    if (!response.ok || !data?.message) { setMessage("Could not send the message."); return; }
    setChatMessages((messages) => [...messages, data.message!]); form.reset();
  }

  /*
   * Logout
   */
  function logout() {
    localStorage.removeItem("campusfind-token");
    localStorage.removeItem("campusfind-user-id");
    localStorage.removeItem("campusfind-profile");

    setToken("");
    setUserId("");
    setProfile(null);

    setMessage("You have been logged out.");

    setPage("home");
  }

  return (
    <div className="app">

      {/* HEADER */}

      <header>
        <button
          className="logo"
          onClick={() => setPage("home")}
        >
          CampusFind
        </button>

        <nav>
          <button onClick={() => setPage("home")}>
            Home
          </button>

          <button onClick={() => setPage("browse")}>
            Browse
          </button>
          <button onClick={() => setPage("campus")}>Campus guide</button>
          {token && <button onClick={() => { setPage("messages"); void loadChatRequests(); }}>Messages</button>}

          <button onClick={reportPage}>
            Report an item
          </button>
        </nav>

        <button
          className="login"
          onClick={openAccount}
        >
          {token ? "My account" : "Log in"}
        </button>
      </header>

      {/* MESSAGE */}

      {message && (
        <div className="notice">
          {message}

          <button onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}

      {/* HOME */}

      {page === "home" && (
        <main>

          <section className="hero">

            <div>
              <p className="eyebrow">
                MRDU LOST & FOUND
              </p>

              <h1>
                Lost or found
                <br />
                something?
              </h1>

              <p>
                Share it with the MRDU community.
                This board helps students report,
                find and return lost items.
              </p>

              <button
                className="primary"
                onClick={reportPage}
              >
                Report an item
              </button>

              <button
                className="outline"
                onClick={() => setPage("browse")}
              >
                Browse reports
              </button>
            </div>

            <aside>
              <p className="eyebrow">
                CAMPUS BOARD
              </p>

              <h2>
                {reports.length === 0
                  ? "No reports yet"
                  : `${reports.length} report${
                      reports.length === 1 ? "" : "s"
                    }`}
              </h2>

              <p>
                Lost and found reports from students
                will appear here.
              </p>

              <button
                className="text-button"
                onClick={reportPage}
              >
                Create a report →
              </button>
            </aside>

          </section>

          <section className="steps">

            <div>
              <p className="eyebrow">
                GET STARTED
              </p>

              <h2>
                Simple, clear, and useful.
              </h2>
            </div>

            <article>
              <b>01</b>

              <h3>
                Report an item
              </h3>

              <p>
                Add details about what you
                lost or found.
              </p>
            </article>

            <article>
              <b>02</b>

              <h3>
                Browse reports
              </h3>

              <p>
                Search the campus board
                for matching items.
              </p>
            </article>

            <article>
              <b>03</b>

              <h3>
                Connect safely
              </h3>

              <p>
                Use the report details to
                help return an item.
              </p>
            </article>

          </section>

          <section className="recent"><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent campus reports</h2><Cards reports={reports.slice(0, 3)} onOpenReport={openReport} /></section>

        </main>
      )}

      {/* BROWSE */}

      {page === "browse" && (
        <main className="page">

          <p className="eyebrow">
            CAMPUS BOARD
          </p>

          <h1>
            Browse reports
          </h1>

          <p>
            Search lost, found, and last-seen
            reports across MRDU.
          </p>

          <div className="filters">

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by item or category"
            />

            {(
              ["ALL", "LOST", "FOUND", "LAST_SEEN"] as const
            ).map((value) => (
              <button
                className={
                  kind === value ? "on" : ""
                }
                key={value}
                onClick={() => setKind(value)}
              >
                {value === "ALL"
                  ? "All"
                  : label[value]}
              </button>
            ))}

          </div>

          <Cards reports={shown} onOpenReport={openReport} />

          <button
            className="primary floating"
            onClick={reportPage}
          >
            + Report an item
          </button>

        </main>
      )}

      {page === "campus" && (
        <main className="page">
          <p className="eyebrow">MRDU CAMPUS GUIDE</p>
          <h1>Explore campus</h1>
          <p>Browse familiar blocks, facilities, and grounds. Select a location to use it in a new report.</p>
          <CampusLayout onSelect={selectCampusPlace} />
        </main>
      )}

      {/* REPORT */}

      {page === "report" && (
        <main className="page">

          <p className="eyebrow">
            NEW REPORT
          </p>

          <h1>
            Report an item
          </h1>

          <p>
            Tell the MRDU community about a
            lost, found or last-seen item.
          </p>

          <form
            className="form"
            onSubmit={create}
          >

            {/* TYPE */}

            <div className="kind">

              {(
                ["LOST", "FOUND", "LAST_SEEN"] as const
              ).map((value, index) => (
                <label key={value}>

                  <input
                    name="reportType"
                    type="radio"
                    value={value}
                    defaultChecked={index === 0}
                  />

                  {label[value]}

                </label>
              ))}

            </div>

            {/* ITEM */}

            <label>
              Item name

              <input
                name="itemName"
                required
                placeholder="e.g. Black wallet"
              />
            </label>

            {/* CATEGORY */}

            <label>
              Category

              <select
                name="category"
                required
                defaultValue=""
              >

                <option
                  value=""
                  disabled
                >
                  Select a category
                </option>

                <option>
                  Electronics
                </option>

                <option>
                  Personal items
                </option>

                <option>
                  Accessories
                </option>

                <option>
                  Documents
                </option>

                <option>
                  Books
                </option>

                <option>
                  Clothing
                </option>

                <option>
                  Other
                </option>

              </select>
            </label>

            {/* DESCRIPTION */}

            <label>
              Description

              <textarea
                name="description"
                required
                placeholder="Colour, brand, identifying marks..."
              />
            </label>

            <label>
              Photo (optional)

              <input
                type="file"
                name="image"
                accept="image/*"
              />

              <small className="field-help">Add a clear photo to help people identify the item. Maximum 3 MB.</small>
            </label>

            {/* DATE */}

            <label>
              Date

              <input
                type="date"
                name="date"
                required
              />
            </label>

            {/* BUILDING */}

            <label>
              Building or area

              <input
                name="building"
                placeholder="e.g. Block 6, Library, CSE Block"
                value={building}
                onChange={(event) => setBuilding(event.target.value)}
              />
            </label>

            {/* MAP */}

            <div className="location">

              <h3>
                Select location on map
              </h3>

              <p>
                Click on the map where the
                item was lost or found.
              </p>

              <CampusMap
                onLocationSelect={(location) => {
                  setSelectedLocation(location);
                }}
              />

              <div className={`zone-status ${coverageZone(selectedLocation).className}`}>
                <strong>{coverageZone(selectedLocation).name}</strong>
                <span>{coverageZone(selectedLocation).detail}</span>
              </div>

              {/* Hidden coordinates sent to backend */}

              <input
                type="hidden"
                name="latitude"
                value={selectedLocation.lat}
                readOnly
              />

              <input
                type="hidden"
                name="longitude"
                value={selectedLocation.lng}
                readOnly
              />

            </div>

            {/* SUBMIT */}

            <button
              className="primary"
              type="submit"
            >
              Publish report
            </button>

          </form>

        </main>
      )}

      {page === "detail" && selectedReport && (
        <main className="page report-detail">
          <button className="link back" onClick={() => setPage("browse")}>← Back to reports</button>
          <p className="eyebrow">REPORT DETAILS</p>
          <span className={`badge ${selectedReport.reportType.toLowerCase()}`}>{label[selectedReport.reportType]}</span>
          <h1>{selectedReport.itemName}</h1>
          {selectedReport.imageUrl && <img className="detail-photo" src={selectedReport.imageUrl} alt={selectedReport.itemName} />}
          <section className="detail-panel">
            <div><strong>Description</strong><p>{selectedReport.description}</p></div>
            <div><strong>Reported on</strong><p>{new Date(selectedReport.date).toLocaleDateString("en-IN", { dateStyle: "long" })}</p></div>
            <div><strong>Location</strong><p>{selectedReport.location?.building ?? selectedReport.location?.zone ?? "Campus"}</p></div>
            <div><strong>Reported by</strong><p>{selectedReport.user?.name ?? "CampusFind member"}{selectedReport.user?.department ? ` · ${selectedReport.user.department}` : ""}</p></div>
          </section>
          <p className="field-help">Contact details stay private. Send a request first; the report owner must accept before the chat opens.</p>
          {selectedReport.user?.id === userId ? <p className="field-help">This is your report.</p> : <button className="primary" onClick={() => requestPrivateChat(selectedReport)}>Request private chat</button>}
        </main>
      )}

      {page === "messages" && (
        <main className="page messages-page">
          <p className="eyebrow">PRIVATE MESSAGES</p><h1>Messages</h1><p>Chat requests stay private until you accept them.</p>
          <section className="message-inbox"><div><h2>Chat requests</h2>{chatRequests.received.filter((request) => request.status === "PENDING").length ? chatRequests.received.filter((request) => request.status === "PENDING").map((request) => <article className="chat-request" key={request.id}><div><b>{request.requester.name}</b><br /><small>Request to discuss: {request.report.itemName}</small></div><span><button className="primary small" onClick={() => respondToChat(request, "accept")}>Accept</button><button className="link" onClick={() => respondToChat(request, "decline")}>Decline</button></span></article>) : <p className="field-help">No pending requests.</p>}</div><div><h2>Conversations</h2>{[...chatRequests.received, ...chatRequests.sent].filter((request) => request.status === "ACCEPTED").map((request) => <button className="open-chat" key={request.id} onClick={() => openChat(request)}><b>{request.requester.id === userId ? request.owner.name : request.requester.name}</b><br />{request.report.itemName}</button>)}</div></section>
          {activeChat && <section className="chat-box"><div className="chat-title"><b>{activeChat.report.itemName}</b><button onClick={() => setActiveChat(null)}>×</button></div><div className="messages">{chatMessages.length ? chatMessages.map((chatMessage) => <p className={chatMessage.sender.id === userId ? "mine" : "theirs"} key={chatMessage.id}><b>{chatMessage.sender.name}</b>{chatMessage.content}</p>) : <span>Start the conversation safely.</span>}</div><form onSubmit={sendChatMessage}><input name="message" maxLength={1000} placeholder="Write a message..." /><button className="primary small">Send</button></form></section>}
        </main>
      )}

      {/* ACCOUNT */}

      {page === "account" && (
        <main className="account">

          <section>

            <p className="eyebrow">
              {token ? "YOUR ACCOUNT" : "WELCOME"}
            </p>

            {token ? (
              <>
                <h1>
                  Your profile
                </h1>

                <p>
                  {profile ? `${profile.name} · ${profile.department} · Year ${profile.year}` : "Your CampusFind account"}
                </p>

                {profile && <div className="profile-details"><span><b>Roll no.</b> {profile.studentId}</span><span><b>Email</b> {profile.email}</span></div>}

                <button
                  className="primary"
                  onClick={reportPage}
                >
                  Create a report
                </button>

                <button
                  className="link"
                  onClick={logout}
                >
                  Log out
                </button>

                <div className="chat-requests">
                  <h2>Private chat requests</h2>
                  {chatRequests.received.filter((request) => request.status === "PENDING").map((request) => (
                    <div className="chat-request" key={request.id}>
                      <div><b>{request.requester.name}</b> wants to discuss <b>{request.report.itemName}</b>.</div>
                      <span><button className="primary small" onClick={() => respondToChat(request, "accept")}>Accept</button><button className="link" onClick={() => respondToChat(request, "decline")}>Decline</button></span>
                    </div>
                  ))}
                  {[...chatRequests.received, ...chatRequests.sent].filter((request) => request.status === "ACCEPTED").map((request) => (
                    <button className="open-chat" key={request.id} onClick={() => openChat(request)}>Open private chat: {request.report.itemName}</button>
                  ))}
                  {!chatRequests.received.some((request) => request.status === "PENDING") && ![...chatRequests.received, ...chatRequests.sent].some((request) => request.status === "ACCEPTED") && <p className="field-help">No chat requests yet.</p>}
                </div>

                <div className="possible-matches">
                  <h2>Possible matches</h2>
                  {possibleMatches.length ? possibleMatches.slice(0, 5).map((match) => (
                    <button className="match-card" key={`${match.source.id}-${match.report.id}`} onClick={() => openReport(match.report)}>
                      <b>{match.report.itemName}</b><span>{match.score}% match · {match.distance} m away</span><small>{match.reasons.join(" · ")}</small>
                    </button>
                  )) : <p className="field-help">No possible matches yet. We compare your active reports with nearby Lost, Found, and Last Seen reports.</p>}
                </div>

                {activeChat && <section className="chat-box">
                  <div className="chat-title"><b>Private chat · {activeChat.report.itemName}</b><button onClick={() => setActiveChat(null)}>×</button></div>
                  <div className="messages">{chatMessages.length ? chatMessages.map((chatMessage) => <p className={chatMessage.sender.id === userId ? "mine" : "theirs"} key={chatMessage.id}><b>{chatMessage.sender.name}</b>{chatMessage.content}</p>) : <span>Start the conversation safely—do not share sensitive details publicly.</span>}</div>
                  <form onSubmit={sendChatMessage}><input name="message" maxLength={1000} placeholder="Write a message..." /><button className="primary small">Send</button></form>
                </section>}
              </>
            ) : (
              <>

                {forgotPassword ? (
                  <>
                    <div className="tabs"><button className="on">Reset password</button></div>
                    {!resetOtpSent ? <form className="auth" onSubmit={requestPasswordReset}>
                      <label>College email<input type="email" name="email" required /></label>
                      <button className="primary" type="submit">Send OTP</button>
                    </form> : <form className="auth" onSubmit={confirmPasswordReset}>
                      <p className="field-help">Enter the 6-digit OTP sent to {resetEmail} and choose a new password.</p>
                      <label>OTP<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
                      <label>New password<input type="password" name="password" minLength={6} required /></label>
                      <button className="primary" type="submit">Reset password</button>
                    </form>}
                    <button className="link" onClick={() => { setForgotPassword(false); setResetOtpSent(false); }}>Back to log in</button>
                  </>
                ) : <>

                <div className="tabs">

                  <button
                    className={!register ? "on" : ""}
                    onClick={() => {
                      setRegister(false);
                      setMessage("");
                    }}
                  >
                    Log in
                  </button>

                  <button
                    className={register ? "on" : ""}
                    onClick={() => {
                      setRegister(true);
                      setMessage("");
                    }}
                  >
                    Create account
                  </button>

                </div>

                <form
                  className="auth"
                  onSubmit={auth}
                >

                  {register && (
                    <>
                      <label>
                        Name

                        <input
                          name="name"
                          required
                        />
                      </label>

                      <label>
                        Student ID

                        <input
                          name="studentId"
                          required
                        />
                      </label>

                      <label>
                        Department

                        <input
                          name="department"
                          required
                        />
                      </label>

                      <label>
                        Year

                        <input
                          type="number"
                          name="year"
                          min="1"
                          required
                        />
                      </label>
                    </>
                  )}

                  <label>
                    College email

                    <input
                      type="email"
                      name="email"
                      required
                    />
                  </label>

                  <label>
                    Password

                    <input
                      type="password"
                      name="password"
                      minLength={6}
                      required
                    />
                  </label>

                  <button
                    className="primary"
                    type="submit"
                  >
                    {register
                      ? "Create account"
                      : "Log in"}
                  </button>

                  {!register && <button className="link" type="button" onClick={() => setForgotPassword(true)}>Forgot password?</button>}

                </form>

                </>}</>)}
          </section>

        </main>
      )}

      <footer>
        CampusFind · Made for the MRDU community
      </footer>

    </div>
  );
}

/*
 * REPORT CARDS
 */

function Cards({
  reports,
  onOpenReport,
}: {
  reports: Report[];
  onOpenReport: (report: Report) => void;
}) {
  return (
    <div className="cards">

      {reports.length ? (
        reports.map((report) => (
          <article
            className="card"
            key={report.id}
          >

            {report.imageUrl && (
              <img className="report-photo" src={report.imageUrl} alt={report.itemName} />
            )}

            <span
              className={`badge ${report.reportType.toLowerCase()}`}
            >
              {label[report.reportType]}
            </span>

            <small>
              {new Date(
                report.date
              ).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </small>

            <h3>
              {report.itemName}
            </h3>

            <p>
              {report.description}
            </p>

            <button className="request-chat" onClick={() => onOpenReport(report)}>
              View report details
            </button>

            <footer>
              Location:{" "}
              {report.location?.building ??
                report.location?.zone ??
                "Campus"}{" "}
              · {report.category}
            </footer>

          </article>
        ))
      ) : (
        <div className="empty">

          <h2>
            No reports yet
          </h2>

          <p>
            When someone adds a lost or
            found item, it will appear here.
          </p>

        </div>
      )}

    </div>
  );
}

export default App;
