import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, getDocs,
  onSnapshot, orderBy, query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4dqhuXY0nCSt3IvnogQOfkR9SVBUYHxc",
  authDomain: "basic-learning-2384f.firebaseapp.com",
  projectId: "basic-learning-2384f",
  storageBucket: "basic-learning-2384f.firebasestorage.app",
  messagingSenderId: "878087809392",
  appId: "1:878087809392:web:7815af97fecd57aa7147b5"
};

const ADMIN_EMAIL = "fuwen@ppsh.ptc.edu.tw";
const HOMEPAGE_MESSAGE_LIMIT = 3;

const DEFAULT_LINKS = [
  { label: "Gmail", url: "https://mail.google.com" },
  { label: "雲端硬碟", url: "https://drive.google.com" },
  { label: "Google表單", url: "https://forms.google.com" },
  { label: "Padlet 班級牆", url: "https://padlet.com/fuwen/padlet-eplgg5eg9fqi8i7" },
  { label: "Gemini", url: "https://gemini.google.com" },
  { label: "ChatGPT", url: "https://chatgpt.com" },
  { label: "Suno", url: "https://suno.com" },
  { label: "Claude", url: "https://claude.ai" }
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");
const adminPanel = document.getElementById("adminPanel");

const messageList = document.getElementById("messageList");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const linkUrlInput = document.getElementById("linkUrlInput");
const linkLabelInput = document.getElementById("linkLabelInput");

const toolLinks = document.getElementById("toolLinks");
const linkForm = document.getElementById("linkForm");
const linkLabelNew = document.getElementById("linkLabelNew");
const linkUrlNew = document.getElementById("linkUrlNew");
const linkManageList = document.getElementById("linkManageList");

let isAdmin = false;
let latestMessages = [];
let latestLinks = [];

/* ---------- auth ---------- */

loginBtn.addEventListener("click", async () => {
  if (auth.currentUser) {
    await signOut(auth);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("登入失敗", err);
  }
});

onAuthStateChanged(auth, async (user) => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;

  if (user) {
    loginBtn.textContent = isAdmin ? "登出（教師）" : "登出";
    loginBtn.classList.toggle("signed-in", isAdmin);
  } else {
    loginBtn.textContent = "教師登入";
    loginBtn.classList.remove("signed-in");
  }

  adminPanel.classList.toggle("hidden", !isAdmin);
  renderMessages(latestMessages);
  renderToolLinks(latestLinks);

  if (isAdmin) await seedDefaultLinksIfEmpty();
});

/* ---------- helpers ---------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 只接受 http/https 開頭的網址，避免不安全的連結格式被寫進頁面
function safeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return escapeHtml(trimmed);
}

/* ---------- announcements ---------- */

const messagesQuery = query(
  collection(db, "messages"),
  orderBy("createdAt", "desc"),
  limit(HOMEPAGE_MESSAGE_LIMIT)
);

onSnapshot(messagesQuery, (snapshot) => {
  latestMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderMessages(latestMessages);
});

function renderMessages(items) {
  if (!items.length) {
    messageList.innerHTML = `<p class="empty-hint">目前沒有公告。</p>`;
    return;
  }
  messageList.innerHTML = items.map((m) => {
    const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("zh-TW") : "";
    const deleteBtn = isAdmin ? `<button data-id="${m.id}" class="delete-msg-btn">刪除</button>` : "";
    const url = safeUrl(m.linkUrl);
    const linkHtml = url
      ? `<a class="msg-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(m.linkLabel || "查看詳情")} →</a>`
      : "";
    return `
      <div class="message-item">
        <div>
          <p>${escapeHtml(m.text)}</p>
          ${linkHtml}
          <p class="msg-meta">${time}</p>
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join("");

  if (isAdmin) {
    messageList.querySelectorAll(".delete-msg-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "messages", btn.dataset.id)));
    });
  }
}

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  await addDoc(collection(db, "messages"), {
    text,
    linkUrl: linkUrlInput.value.trim(),
    linkLabel: linkLabelInput.value.trim(),
    createdAt: serverTimestamp()
  });
  messageForm.reset();
});

/* ---------- quick links ---------- */

const linksQuery = query(collection(db, "quicklinks"), orderBy("createdAt", "asc"));

onSnapshot(linksQuery, (snapshot) => {
  latestLinks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderToolLinks(latestLinks);
});

function renderToolLinks(items) {
  toolLinks.innerHTML = items.map((l) => {
    const url = safeUrl(l.url);
    if (!url) return "";
    const deleteBtn = isAdmin ? `<button data-id="${l.id}" class="chip-delete" title="刪除連結">×</button>` : "";
    return `
      <span class="tool-chip-wrap">
        ${deleteBtn}
        <a class="tool-chip" href="${url}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>
      </span>
    `;
  }).join("");

  if (isAdmin) {
    toolLinks.querySelectorAll(".chip-delete").forEach((btn) => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "quicklinks", btn.dataset.id)));
    });
  }
  renderLinkManageList(items);
}

function renderLinkManageList(items) {
  if (!isAdmin) {
    linkManageList.innerHTML = "";
    return;
  }
  linkManageList.innerHTML = items.map((l) => `
    <div class="link-manage-item">
      <span>${escapeHtml(l.label)}<span class="lm-url">${escapeHtml(l.url)}</span></span>
      <button data-id="${l.id}" class="delete-link-btn">刪除</button>
    </div>
  `).join("");

  linkManageList.querySelectorAll(".delete-link-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteDoc(doc(db, "quicklinks", btn.dataset.id)));
  });
}

linkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = linkLabelNew.value.trim();
  const url = linkUrlNew.value.trim();
  if (!label || !safeUrl(url)) return;
  await addDoc(collection(db, "quicklinks"), {
    label,
    url,
    createdAt: serverTimestamp()
  });
  linkForm.reset();
});

async function seedDefaultLinksIfEmpty() {
  const snap = await getDocs(collection(db, "quicklinks"));
  if (!snap.empty) return;
  for (const link of DEFAULT_LINKS) {
    await addDoc(collection(db, "quicklinks"), { ...link, createdAt: serverTimestamp() });
  }
}
