(function () {
  "use strict";

  // ---------- Config / client setup ----------
  var configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    window.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1;

  document.getElementById("app-title").textContent = window.APP_NAME || "Story Bank";
  document.title = window.APP_NAME || "Story Bank";

  if (!configured) {
    document.getElementById("setup-hint").hidden = false;
    document.getElementById("sign-in").disabled = true;
    document.getElementById("sign-up").disabled = true;
    setAuthMsg("Not configured yet — see the hint below.", "error");
  }

  var supabase = configured
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

  // ---------- Elements ----------
  var authSection = document.getElementById("auth-section");
  var appSection = document.getElementById("app-section");
  var accountEl = document.getElementById("account");
  var accountEmail = document.getElementById("account-email");

  var emailEl = document.getElementById("email");
  var passwordEl = document.getElementById("password");
  var authMsgEl = document.getElementById("auth-msg");

  var deck = document.getElementById("deck");
  var tagbar = document.getElementById("tagbar");
  var empty = document.getElementById("empty");
  var countEl = document.getElementById("count");
  var searchEl = document.getElementById("search");
  var clearBtn = document.getElementById("clear-search");
  var dateFromPicker = createMonthPicker(document.getElementById("date-from"), "from", function () { render(); });
  var dateToPicker = createMonthPicker(document.getElementById("date-to"), "to", function () { render(); });
  var clearDatesBtn = document.getElementById("clear-dates");

  var modalBackdrop = document.getElementById("modal-backdrop");
  var modalTitle = document.getElementById("modal-title");
  var modalMsg = document.getElementById("modal-msg");
  var fTitle = document.getElementById("f-title");
  var fTags = document.getElementById("f-tags");
  var occurredPicker = createMonthPicker(document.getElementById("f-occurred"), "month / year", null);
  var fAnswers = document.getElementById("f-answers");
  var fAnchor = document.getElementById("f-anchor");
  var fScript = document.getElementById("f-script");
  var modalDelete = document.getElementById("modal-delete");

  // ---------- State ----------
  var stories = [];
  var activeTags = [];
  var editingId = null; // null = adding new

  try {
    var savedTags = localStorage.getItem("storybank-active-tags");
    if (savedTags) {
      activeTags = JSON.parse(savedTags);
    } else {
      // Migrate from the old single-tag key
      var oldTag = localStorage.getItem("storybank-active-tag");
      if (oldTag) activeTags = [oldTag];
    }
  } catch (e) { activeTags = []; }

  // ---------- Auth wiring ----------
  function setAuthMsg(text, kind) {
    authMsgEl.textContent = text || "";
    authMsgEl.className = "auth-msg" + (kind ? " " + kind : "");
  }

  function showApp(user) {
    authSection.hidden = true;
    appSection.hidden = false;
    accountEl.hidden = false;
    accountEmail.textContent = user.email || "";
    loadStories();
  }

  function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
    accountEl.hidden = true;
    stories = [];
  }

  if (configured) {
    supabase.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (session) showApp(session.user); else showAuth();
    });

    supabase.auth.onAuthStateChange(function (_event, session) {
      if (session) showApp(session.user); else showAuth();
    });

    document.getElementById("sign-in").addEventListener("click", function () {
      setAuthMsg("Signing in…");
      supabase.auth.signInWithPassword({ email: emailEl.value.trim(), password: passwordEl.value })
        .then(function (res) {
          if (res.error) setAuthMsg(res.error.message, "error");
          else setAuthMsg("");
        });
    });

    document.getElementById("sign-up").addEventListener("click", function () {
      setAuthMsg("Creating account…");
      supabase.auth.signUp({ email: emailEl.value.trim(), password: passwordEl.value })
        .then(function (res) {
          if (res.error) { setAuthMsg(res.error.message, "error"); return; }
          if (res.data && res.data.session) {
            setAuthMsg("Account created.", "ok");
          } else {
            setAuthMsg("Check your email to confirm your account, then sign in.", "ok");
          }
        });
    });

    document.getElementById("sign-out").addEventListener("click", function () {
      supabase.auth.signOut();
    });
  }

  // ---------- Data ----------
  function loadStories() {
    supabase.from("stories").select("*").order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        stories = res.data || [];
        renderTagbar();
        render();
      });
  }

  function upsertStory(payload, id) {
    var query = id
      ? supabase.from("stories").update(payload).eq("id", id).select()
      : supabase.from("stories").insert(payload).select();
    return query.then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function deleteStory(id) {
    return supabase.from("stories").delete().eq("id", id);
  }

  // ---------- Rendering ----------
  function md(s) {
    if (!s) return "";
    var div = document.createElement("div");
    div.textContent = s;
    var escaped = div.innerHTML;
    return escaped.replace(/\*\*(.+?)\*\*/g, "<mark>$1</mark>");
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // "2023-03" → "Mar 2023"
  function monthLabel(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(ym || "");
    if (!m) return "";
    var idx = parseInt(m[2], 10) - 1;
    return (MONTHS[idx] || m[2]) + " " + m[1];
  }

  // A button that shows its placeholder (grey italic) when empty, "Mar 2024"
  // when set, and opens a small ‹ year › + month-grid popover on click.
  function createMonthPicker(btn, placeholder, onChange) {
    var value = "";
    var pop = null;
    var viewYear = new Date().getFullYear();
    var maxYear = new Date().getFullYear();

    function fmt() {
      if (value) { btn.textContent = monthLabel(value); btn.classList.remove("placeholder"); }
      else { btn.textContent = placeholder; btn.classList.add("placeholder"); }
    }

    function close() {
      if (!pop) return;
      pop.remove();
      pop = null;
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
    }
    function onDocClick(e) { if (!pop.contains(e.target) && e.target !== btn) close(); }
    function onKey(e) { if (e.key === "Escape") close(); }

    function build() {
      pop.innerHTML = "";
      var head = document.createElement("div");
      head.className = "month-pop-head";
      var prev = document.createElement("button");
      prev.type = "button";
      prev.textContent = "‹";
      prev.addEventListener("click", function () { viewYear--; build(); });
      var yearLbl = document.createElement("span");
      yearLbl.textContent = viewYear;
      var next = document.createElement("button");
      next.type = "button";
      next.textContent = "›";
      next.disabled = viewYear >= maxYear;
      next.addEventListener("click", function () { viewYear++; build(); });
      head.appendChild(prev); head.appendChild(yearLbl); head.appendChild(next);
      pop.appendChild(head);

      var grid = document.createElement("div");
      grid.className = "month-grid";
      MONTHS.forEach(function (name, i) {
        var m = document.createElement("button");
        m.type = "button";
        m.textContent = name;
        var ym = viewYear + "-" + String(i + 1).padStart(2, "0");
        if (ym === value) m.className = "selected";
        m.addEventListener("click", function () {
          value = ym;
          fmt();
          close();
          if (onChange) onChange();
        });
        grid.appendChild(m);
      });
      pop.appendChild(grid);

      if (value) {
        var clear = document.createElement("button");
        clear.type = "button";
        clear.className = "month-pop-clear";
        clear.textContent = "clear";
        clear.addEventListener("click", function () {
          value = "";
          fmt();
          close();
          if (onChange) onChange();
        });
        pop.appendChild(clear);
      }
    }

    btn.addEventListener("click", function () {
      if (pop) { close(); return; }
      viewYear = value ? parseInt(value.slice(0, 4), 10) : new Date().getFullYear();
      pop = document.createElement("div");
      pop.className = "month-pop";
      build();
      document.body.appendChild(pop);
      var r = btn.getBoundingClientRect();
      var left = Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8);
      pop.style.left = Math.max(8, left) + "px";
      pop.style.top = (r.bottom + window.scrollY + 6) + "px";
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
    });

    fmt();
    return {
      get: function () { return value; },
      set: function (v) { value = v || ""; fmt(); close(); }
    };
  }

  function allTags() {
    var set = {};
    stories.forEach(function (s) { (s.tags || []).forEach(function (t) { set[t] = true; }); });
    return Object.keys(set).sort();
  }

  function renderTagbar() {
    tagbar.innerHTML = "";
    allTags().forEach(function (cat) {
      var b = document.createElement("button");
      b.className = "tag";
      b.type = "button";
      b.textContent = cat;
      b.setAttribute("aria-pressed", String(activeTags.indexOf(cat) !== -1));
      b.addEventListener("click", function () {
        var i = activeTags.indexOf(cat);
        if (i === -1) activeTags.push(cat); else activeTags.splice(i, 1);
        try { localStorage.setItem("storybank-active-tags", JSON.stringify(activeTags)); } catch (e) {}
        render();
      });
      tagbar.appendChild(b);
    });
  }

  function render() {
    var q = searchEl.value.trim().toLowerCase();
    clearBtn.style.display = q ? "inline-block" : "none";
    var dFrom = dateFromPicker.get(); // "YYYY-MM" or ""
    var dTo = dateToPicker.get();
    clearDatesBtn.hidden = !(dFrom || dTo);

    Array.prototype.forEach.call(tagbar.children, function (b) {
      b.setAttribute("aria-pressed", String(activeTags.indexOf(b.textContent) !== -1));
    });

    deck.innerHTML = "";
    var shown = 0;

    stories.forEach(function (story) {
      var matchesTag = activeTags.length === 0 || activeTags.every(function (t) {
        return (story.tags || []).indexOf(t) !== -1;
      });
      var haystack = [story.title, (story.tags || []).join(" "), story.answers_for, story.anchor, story.script]
        .join(" ").toLowerCase();
      var matchesSearch = !q || haystack.indexOf(q) !== -1;
      // "YYYY-MM" strings compare correctly as text. A story with no
      // occurrence date is hidden while a date filter is active.
      var matchesDate = (!dFrom && !dTo) || (story.occurred_on &&
        (!dFrom || story.occurred_on >= dFrom) &&
        (!dTo || story.occurred_on <= dTo));
      if (!(matchesTag && matchesSearch && matchesDate)) return;
      shown++;
      deck.appendChild(renderCard(story));
    });

    empty.hidden = shown !== 0;
    var dateNote = "";
    if (dFrom || dTo) {
      dateNote = " · occurred " + (dFrom ? monthLabel(dFrom) : "…") + " – " + (dTo ? monthLabel(dTo) : "…");
    }
    countEl.textContent = shown + " of " + stories.length + " stories" +
      (activeTags.length ? " · " + activeTags.join(", ") : "") + dateNote + (q ? " · “" + q + "”" : "");
  }

  function renderCard(story) {
    var card = document.createElement("details");
    card.className = "card";

    var summary = document.createElement("summary");

    var headText = document.createElement("div");
    headText.className = "head-text";

    var tagsRow = document.createElement("div");
    tagsRow.className = "card-tags";
    (story.tags || []).forEach(function (t) {
      var mt = document.createElement("span");
      mt.className = "mini-tag";
      mt.textContent = t;
      tagsRow.appendChild(mt);
    });

    var h2 = document.createElement("h2");
    h2.textContent = story.title;

    var anchorP = document.createElement("div");
    anchorP.className = "anchor";
    anchorP.innerHTML = md(story.anchor);

    headText.appendChild(h2);
    headText.appendChild(tagsRow);
    headText.appendChild(anchorP);

    var actions = document.createElement("div");
    actions.className = "card-actions";
    var editBtn = document.createElement("button");
    editBtn.className = "btn small ghost";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal(story);
    });
    actions.appendChild(editBtn);

    var chevron = document.createElement("div");
    chevron.className = "chevron";
    chevron.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>';

    summary.appendChild(headText);
    summary.appendChild(actions);
    summary.appendChild(chevron);

    var body = document.createElement("div");
    body.className = "body";
    if (story.answers_for) {
      var answersFor = document.createElement("p");
      answersFor.className = "answers-for";
      answersFor.textContent = "Answers: " + story.answers_for;
      body.appendChild(answersFor);
    }
    var scriptP = document.createElement("p");
    scriptP.className = "script";
    scriptP.innerHTML = md(story.script);
    body.appendChild(scriptP);

    card.appendChild(summary);
    card.appendChild(body);

    // Closed <details> elements hide every child except <summary> — so the
    // date badge can't live inside the card itself, or it vanishes whenever
    // the card is collapsed. Wrap card + badge in a plain positioned div
    // instead, which isn't subject to that native collapsing behavior.
    var wrap = document.createElement("div");
    wrap.className = "card-wrap";
    wrap.appendChild(card);

    if (story.occurred_on) {
      var when = document.createElement("span");
      when.className = "occurred";
      when.textContent = monthLabel(story.occurred_on);
      when.title = "When this story took place (not when it was added)";
      card.classList.add("has-date");
      wrap.appendChild(when);
    }
    return wrap;
  }

  searchEl.addEventListener("input", render);
  clearDatesBtn.addEventListener("click", function () {
    dateFromPicker.set("");
    dateToPicker.set("");
    render();
  });
  clearBtn.addEventListener("click", function () {
    searchEl.value = "";
    searchEl.focus();
    render();
  });
  document.getElementById("empty-add-link").addEventListener("click", function (e) {
    e.preventDefault();
    openModal(null);
  });

  // ---------- Modal ----------
  function openModal(story) {
    editingId = story ? story.id : null;
    modalTitle.textContent = story ? "Edit story" : "Add a story";
    modalDelete.hidden = !story;
    modalMsg.textContent = "";
    fTitle.value = story ? story.title : "";
    fTags.value = story ? (story.tags || []).join(", ") : "";
    occurredPicker.set(story ? story.occurred_on || "" : "");
    fAnswers.value = story ? story.answers_for || "" : "";
    fAnchor.value = story ? story.anchor || "" : "";
    fScript.value = story ? story.script || "" : "";
    modalBackdrop.hidden = false;
    fTitle.focus();
  }
  function closeModal() { modalBackdrop.hidden = true; editingId = null; }

  document.getElementById("btn-add").addEventListener("click", function () { openModal(null); });
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", function (e) { if (e.target === modalBackdrop) closeModal(); });

  document.getElementById("modal-save").addEventListener("click", function () {
    var title = fTitle.value.trim();
    if (!title) { modalMsg.textContent = "Give it a title."; return; }
    var payload = {
      title: title,
      tags: fTags.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
      occurred_on: occurredPicker.get() || null,
      answers_for: fAnswers.value.trim(),
      anchor: fAnchor.value.trim(),
      script: fScript.value.trim()
    };
    if (!editingId) {
      supabase.auth.getUser().then(function (res) {
        payload.user_id = res.data.user.id;
        upsertStory(payload, null)
          .then(function () { closeModal(); loadStories(); })
          .catch(function (err) { modalMsg.textContent = err.message; });
      });
    } else {
      upsertStory(payload, editingId)
        .then(function () { closeModal(); loadStories(); })
        .catch(function (err) { modalMsg.textContent = err.message; });
    }
  });

  modalDelete.addEventListener("click", function () {
    if (!editingId) return;
    if (!confirm("Delete this story? This can't be undone.")) return;
    deleteStory(editingId).then(function (res) {
      if (res.error) { modalMsg.textContent = res.error.message; return; }
      closeModal();
      loadStories();
    });
  });

  // ---------- Import / export ----------
  document.getElementById("btn-export").addEventListener("click", function () {
    var exportable = stories.map(function (s) {
      return { title: s.title, tags: s.tags, occurred_on: s.occurred_on || null, answers_for: s.answers_for, anchor: s.anchor, script: s.script };
    });
    var blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "story-bank-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  var importFile = document.getElementById("import-file");
  document.getElementById("btn-import").addEventListener("click", function () { importFile.click(); });
  importFile.addEventListener("change", function () {
    var file = importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var items;
      try { items = JSON.parse(reader.result); } catch (e) { alert("That file isn't valid JSON."); return; }
      if (!Array.isArray(items)) { alert("Expected a JSON array of stories."); return; }
      supabase.auth.getUser().then(function (res) {
        var uid = res.data.user.id;
        var rows = items.map(function (it) {
          return {
            user_id: uid,
            title: it.title || "Untitled",
            tags: Array.isArray(it.tags) ? it.tags : [],
            occurred_on: /^\d{4}-\d{2}$/.test(it.occurred_on || "") ? it.occurred_on : null,
            answers_for: it.answers_for || "",
            anchor: it.anchor || "",
            script: it.script || ""
          };
        });
        supabase.from("stories").insert(rows).then(function (r) {
          if (r.error) { alert("Import failed: " + r.error.message); return; }
          loadStories();
        });
      });
    };
    reader.readAsText(file);
    importFile.value = "";
  });
})();
