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
    loginBtn.classList.toggle("border-emerald-500/60", isAdmin);
    loginBtn.classList.toggle("text-emerald-400", isAdmin);
  } else {
    loginBtn.textContent = "教師登入";
    loginBtn.classList.remove("border-emerald-500/60", "text-emerald-400");
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
    messageList.innerHTML = `<p class="text-slate-500">目前沒有公告。</p>`;
    return;
  }
  messageList.innerHTML = items.map((m) => {
    const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("zh-TW") : "";
    const deleteBtn = isAdmin
      ? `<button data-id="${m.id}" class="delete-msg-btn text-rose-400 hover:text-rose-300 text-xs whitespace-nowrap">刪除</button>`
      : "";
    const url = safeUrl(m.linkUrl);
    const linkHtml = url
      ? `<a class="inline-block mt-2 text-cyan-400 hover:underline text-sm font-medium" href="${url}" target="_blank" rel="noopener">${escapeHtml(m.linkLabel || "查看詳情")} →</a>`
      : "";
    return `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-4 flex justify-between gap-4 items-start">
        <div>
          <p class="text-slate-200">${escapeHtml(m.text)}</p>
          ${linkHtml}
          <p class="text-slate-600 text-xs mt-1">${time}</p>
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
    const deleteBtn = isAdmin
      ? `<button data-id="${l.id}" class="chip-delete text-slate-600 hover:text-rose-400 transition-colors pl-2" title="刪除連結">×</button>`
      : "";
    return `
      <span class="inline-flex items-center bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-lg pr-2 transition-all duration-200 whitespace-nowrap">
        <a class="text-slate-300 hover:text-cyan-400 rounded-lg px-3 py-1.5 text-xs font-mono transition-colors" href="${url}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>
        ${deleteBtn}
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
    <div class="flex justify-between items-center bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-sm">
      <span class="text-slate-300">${escapeHtml(l.label)}<span class="text-slate-600 ml-2 text-xs">${escapeHtml(l.url)}</span></span>
      <button data-id="${l.id}" class="delete-link-btn text-rose-400 hover:text-rose-300 text-xs whitespace-nowrap">刪除</button>
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
