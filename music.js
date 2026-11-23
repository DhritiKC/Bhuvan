/* music.js - playlist that continues across pages */
(function () {
  var PLAYLIST = [
    "song1.mp3",
    "song2.mp3",
    "song3.mp3",
    "song4.mp3",
    "song5.mp3"
  ];

  /* OPTIONAL: pin a song to a page (index in PLAYLIST, starting at 0).
     Leave it empty {} for a normal playlist everywhere. */
  var PAGE_SONGS = {
    // "Happy_Birthday_Page_7_Letter.html": 2,
    // "Happy_Birthday_Page_9.html": 4
  };

  var VOLUME = 0.6;
  var KEY = "bd_music_v2";

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}

  var muted = !!saved.muted, ducked = false, started = false, hintOff = false;
  var idx = saved.i || 0;
  var resumeAt = saved.t || 0;
  if (saved.playing && saved.ts) {
    var gap = (Date.now() - saved.ts) / 1000;
    if (gap >= 0 && gap < 5) resumeAt += gap;
  }

  /* a pinned song for this page overrides the saved track */
  var page = location.pathname.split("/").pop() || "index.html";
  if (PAGE_SONGS.hasOwnProperty(page) && PAGE_SONGS[page] !== idx) {
    idx = PAGE_SONGS[page]; resumeAt = 0;
  }
  if (idx >= PLAYLIST.length) { idx = 0; resumeAt = 0; }

  var a = new Audio();
  a.preload = "auto"; a.volume = 0;
  var loop1 = PLAYLIST.length === 1;
  a.loop = loop1;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        i: idx,
        t: started ? a.currentTime : resumeAt,
        muted: muted,
        playing: started && !a.paused,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  /* ---- buttons: mute + next song ---- */
  var base = "position:fixed;z-index:60;top:calc(env(safe-area-inset-top,0px) + 10px);width:42px;height:42px;border-radius:50%;" +
    "border:1.5px solid rgba(240,217,154,.75);background:rgba(43,10,16,.55);color:#f0d99a;font-size:19px;line-height:1;cursor:pointer;" +
    "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:0;-webkit-tap-highlight-color:transparent;";
  var b = document.createElement("button");
  b.type = "button"; b.setAttribute("aria-label", "Music on or off");
  b.style.cssText = base + "right:10px";
  var nx = document.createElement("button");
  nx.type = "button"; nx.setAttribute("aria-label", "Next song");
  nx.textContent = "\u23ED";
  nx.style.cssText = base + "right:60px;font-size:17px";
  function icon() { b.textContent = muted ? "\uD83D\uDD07" : "\uD83C\uDFB5"; b.style.opacity = muted ? ".65" : "1"; }
  icon();

  b.addEventListener("click", function (e) {
    e.stopPropagation();
    muted = !muted; icon();
    if (muted) { hidePill(); fadeTo(0, 250, function () { a.pause(); save(); }); }
    else { play(); }
    save();
  });
  nx.addEventListener("click", function (e) {
    e.stopPropagation();
    if (muted) { muted = false; icon(); }
    nextSong();
  });
  function addBtns() {
    if (document.body) {
      document.body.appendChild(b);
      if (PLAYLIST.length > 1) document.body.appendChild(nx);
    } else addEventListener("DOMContentLoaded", addBtns);
  }
  addBtns();

  /* ---- "tap for music" hint when autoplay is blocked ---- */
  var pill = document.createElement("div");
  pill.textContent = "\u266A Tap anywhere for music";
  pill.style.cssText = "position:fixed;z-index:59;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translateX(-50%);" +
    "padding:8px 16px;border-radius:999px;font:italic 1rem 'Cormorant Garamond',serif;color:#f0d99a;" +
    "background:rgba(43,10,16,.6);border:1px solid rgba(240,217,154,.5);pointer-events:none;opacity:0;transition:opacity .5s";
  function showPill() { if (muted || hintOff) return; if (!pill.parentNode && document.body) document.body.appendChild(pill); pill.style.opacity = "1"; }
  function hidePill() { pill.style.opacity = "0"; }

  /* ---- fading ---- */
  var fadeT;
  function fadeTo(v, ms, done) {
    clearInterval(fadeT);
    var from = a.volume, steps = Math.max(1, ms / 40), i = 0;
    fadeT = setInterval(function () {
      i++; a.volume = Math.min(1, Math.max(0, from + (v - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeT); a.volume = v; if (done) done(); }
    }, 40);
  }

  /* ---- loading + switching songs ---- */
  var seeked = false, fails = 0;
  function load(i, at) {
    idx = i; resumeAt = at || 0; seeked = false;
    a.src = PLAYLIST[idx];
  }
  function seek() {
    if (seeked || !isFinite(a.duration) || a.duration < 2) return;
    seeked = true;
    if (resumeAt > 0) { try { a.currentTime = resumeAt % a.duration; } catch (e) {} }
  }
  function nextSong() {
    load((idx + 1) % PLAYLIST.length, 0);
    started = false;
    play();
  }

  a.addEventListener("loadedmetadata", function () { seek(); play(); });
  a.addEventListener("canplay", function () { if (!started) play(); });
  a.addEventListener("ended", function () { if (!loop1) nextSong(); });
  a.addEventListener("error", function () {
    console.warn("Song failed to load:", PLAYLIST[idx]);
    if (++fails >= PLAYLIST.length) { b.remove(); nx.remove(); return; }
    nextSong();   // skip a broken file
  });

  function play() {
    if (muted || ducked) return;
    seek();
    var p = a.play();
    if (p && p.then) {
      p.then(function () {
        started = true; fails = 0; hidePill(); offGesture();
        fadeTo(VOLUME, saved.playing ? 400 : 1200);
        save();
      }).catch(function () { started = false; showPill(); });
    }
  }

  /* ---- first tap/key starts the music if autoplay was blocked ---- */
  var evs = ["pointerdown", "touchend", "click", "keydown"];
  function onGesture() { if (!started) play(); }
  function offGesture() { evs.forEach(function (n) { removeEventListener(n, onGesture, true); }); }
  evs.forEach(function (n) { addEventListener(n, onGesture, true); });

  load(idx, resumeAt);
  play();

  /* ---- remember position ---- */
  setInterval(function () { if (started && !a.paused) save(); }, 500);
  addEventListener("pagehide", save);
  addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { save(); a.pause(); }
    else if (started) { play(); }
  });

  /* other pages (e.g. the candle page) can pause the music briefly */
  window.BDMusic = {
    noHint: function () { hintOff = true; hidePill(); },
    duck: function (on) {
      ducked = !!on;
      if (on) fadeTo(0, 300, function () { a.pause(); });
      else play();
    }
  };
})();