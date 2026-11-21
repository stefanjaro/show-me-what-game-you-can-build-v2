/* EMBERWAKE — DOM layer: captions, prompts, choices, act cards, endings. */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {};
  var typing = false;
  var currentResolve = null;
  var captionGen = 0;
  var lastLamp = 1, lampTimer = null;

  function init() {
    el.hud = $('hud');
    el.gaugeLamp = $('gaugeLamp');
    el.lampFill = $('lampFill');
    el.cityFill = $('cityFill');
    el.combo = $('combo');
    el.prompt = $('prompt');
    el.readout = $('readout');
    el.caption = $('caption');
    el.captionText = $('captionText');
    el.choice = $('choice');
    el.choiceTitle = $('choiceTitle');
    el.choiceTimer = $('choiceTimer');
    el.choiceTimerWrap = $('choiceTimerWrap');
    el.choiceCards = $('choiceCards');
    el.actcard = $('actcard');
    el.actKicker = $('actKicker');
    el.actTitle = $('actTitle');
    el.actLine = $('actLine');
    el.title = $('title');
    el.prologue = $('prologue');
    el.endscreen = $('endscreen');
    el.endKicker = $('endKicker');
    el.endTitle = $('endTitle');
    el.endBody = $('endBody');
    el.endStats = $('endStats');
    el.flash = $('flash');
    el.lbTop = document.querySelector('#letterbox .top');
    el.lbBottom = document.querySelector('#letterbox .bottom');
    el.fadeout = $('fadeout');
    el.stage = $('stage');

    el.prologue.innerHTML = 'Nine winters you have kept the lamp of Vell. ' +
      'Tonight the oil is low, the glass is cold, and the long dark has come. ' +
      'Everything below you is asleep and depends on one small flame.';
  }

  /* ------------------------------------------------------- caption typing */
  function parseMarkup(s) {
    var out = [], em = false, buf = '';
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '<') {
        var close = s.indexOf('>', i);
        if (close > -1) {
          if (buf) { out.push({ em: em, t: buf }); buf = ''; }
          var tag = s.slice(i + 1, close).toLowerCase();
          if (tag === 'em') em = true; else if (tag === '/em') em = false;
          i = close;
          continue;
        }
      }
      buf += s[i];
    }
    if (buf) out.push({ em: em, t: buf });
    return out;
  }

  function buildHTML(tokens, count) {
    var html = '', used = 0;
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (used >= count) break;
      var take = Math.min(tk.t.length, count - used);
      used += take;
      var piece = tk.t.slice(0, take);
      html += tk.em ? '<em>' + piece + '</em>' : piece;
    }
    return html;
  }

  function caption(text, opts) {
    opts = opts || {};
    captionGen++;
    var gen = captionGen;
    if (currentResolve) { currentResolve(); currentResolve = null; }
    typing = true;
    el.caption.classList.add('show');
    var tokens = parseMarkup(text);
    var total = 0;
    for (var i = 0; i < tokens.length; i++) total += tokens[i].t.length;
    var shown = 0;
    var t0 = performance.now();
    var speed = opts.speed || (total > 150 ? 16 : 24);

    return new Promise(function (resolve) {
      currentResolve = resolve;
      function step(now) {
        if (gen !== captionGen) { resolve(); return; }
        var want = Math.floor((now - t0) / speed);
        if (want > shown) {
          var add = Math.min(want - shown, 6);
          shown += add;
          el.captionText.innerHTML = buildHTML(tokens, shown);
        }
        if (shown < total) {
          requestAnimationFrame(step);
        } else {
          typing = false;
          if (currentResolve === resolve) currentResolve = null;
          var hold = opts.hold === undefined ? 1100 : opts.hold;
          setTimeout(function () {
            if (gen !== captionGen) { resolve(); return; }
            el.caption.classList.remove('show');
            setTimeout(resolve, 380);
          }, hold);
        }
      }
      if (opts.instant) {
        el.captionText.innerHTML = buildHTML(tokens, total);
        typing = false;
        if (currentResolve === resolve) currentResolve = null;
        var h2 = opts.hold === undefined ? 1100 : opts.hold;
        setTimeout(function () { el.caption.classList.remove('show'); setTimeout(resolve, 380); }, h2);
      } else {
        requestAnimationFrame(step);
      }
    });
  }

  function clearCaption() {
    captionGen++;
    typing = false;
    if (currentResolve) { currentResolve(); currentResolve = null; }
    el.caption.classList.remove('show');
  }

  /* ------------------------------------------------------- simple setters */
  function setPrompt(txt) {
    if (!txt) { el.prompt.style.opacity = 0; return; }
    el.prompt.textContent = txt;
    el.prompt.style.opacity = 1;
  }
  function setReadout(txt) {
    if (!txt) { el.readout.style.opacity = 0; return; }
    el.readout.textContent = txt;
    el.readout.style.opacity = 1;
  }
  function setCombo(txt) {
    if (!txt) { el.combo.style.opacity = 0; return; }
    el.combo.textContent = txt;
    el.combo.style.opacity = 1;
  }
  function setLamp(p) {
    var v = U.clamp(p, 0, 1);
    el.lampFill.style.width = v * 100 + '%';
    if (v < lastLamp - 0.004) {
      el.gaugeLamp.classList.add('drop');
      clearTimeout(lampTimer);
      lampTimer = setTimeout(function () { el.gaugeLamp.classList.remove('drop'); }, 520);
    }
    lastLamp = v;
  }
  function setCity(p) { el.cityFill.style.width = U.clamp(p, 0, 1) * 100 + '%'; }
  function showHUD(v) { el.hud.classList.toggle('off', !v); }

  function flash(a, dur) {
    el.flash.style.transition = 'none';
    el.flash.style.opacity = a;
    requestAnimationFrame(function () {
      el.flash.style.transition = 'opacity ' + (dur || 0.6) + 's ease-out';
      el.flash.style.opacity = 0;
    });
  }
  function letterbox(on, h) {
    var px = on ? (h || '9vh') : '0';
    el.lbTop.style.height = px;
    el.lbBottom.style.height = px;
  }
  function fade(on, dur) {
    el.fadeout.style.transition = 'opacity ' + (dur || 0.9) + 's ease';
    el.fadeout.style.opacity = on ? 1 : 0;
  }

  /* ------------------------------------------------------- act card */
  function actCard(kicker, title, line, holdMs) {
    el.actKicker.textContent = kicker;
    el.actTitle.textContent = title;
    el.actLine.textContent = line;
    el.actcard.classList.remove('off');
    letterbox(true, '8vh');
    return new Promise(function (res) {
      setTimeout(function () {
        el.actcard.classList.add('off');
        letterbox(false);
        setTimeout(res, 700);
      }, holdMs || 2600);
    });
  }

  /* ------------------------------------------------------- choice panel */
  var choiceResolve = null;
  var choiceTimerId = null;
  var choiceCount = 0;

  function buildChoice(opts) {
    el.choiceTitle.textContent = opts.title || 'WHAT WILL YOU GIVE?';
    el.choiceCards.innerHTML = '';
    var cards = [];
    var n = opts.options.length;
    for (var i = 0; i < n; i++) {
      (function (idx) {
        var o = opts.options[idx];
        var card = document.createElement('div');
        card.className = 'card';
        var cv = document.createElement('canvas');
        cv.width = 132; cv.height = 132;
        cv.style.width = '66px'; cv.style.height = '66px';
        var key = document.createElement('div');
        key.className = 'ckey';
        key.textContent = 'PRESS ' + (idx + 1);
        var lab = document.createElement('div');
        lab.className = 'clabel';
        lab.innerHTML = o.label;
        card.appendChild(cv); card.appendChild(key); card.appendChild(lab);
        card.addEventListener('mouseenter', function () { Snd.sfx.ui(); });
        card.addEventListener('click', function () { resolveChoice(idx); });
        el.choiceCards.appendChild(card);
        cards.push(card);
        Scene.paintSymbol(cv, o.icon, '#ffe6b8');
      })(i);
    }
    el.choice.classList.remove('off');
    choiceCount = n;

    var dur = opts.time || 12;
    var t0 = performance.now();
    function tick() {
      var p = (performance.now() - t0) / (dur * 1000);
      el.choiceTimer.style.width = (100 - Math.min(100, p * 100)) + '%';
      if (p >= 1) { resolveChoice(-1); return; }
      choiceTimerId = requestAnimationFrame(tick);
    }
    choiceTimerId = requestAnimationFrame(tick);

    return new Promise(function (res) { choiceResolve = res; });
  }

  function resolveChoice(idx) {
    if (!choiceResolve) return;
    if (idx >= 0 && idx >= choiceCount) return;
    var r = choiceResolve;
    choiceResolve = null;
    if (choiceTimerId) cancelAnimationFrame(choiceTimerId);
    el.choice.classList.add('off');
    r(idx);
  }

  function hasChoice() { return !!choiceResolve; }

  function hideChoice() { resolveChoice(-2); }

  /* ------------------------------------------------------- title & end */
  function showTitle(v) {
    el.title.style.opacity = v ? 1 : 0;
    el.title.style.pointerEvents = v ? 'auto' : 'none';
  }

  function showEnd(data) {
    el.endKicker.textContent = data.kicker || 'DAWN';
    el.endTitle.textContent = data.title || '';
    el.endBody.innerHTML = data.body || '';
    el.endStats.innerHTML = (data.stats || []).map(function (s) {
      return '<div><b>' + s.v + '</b>' + s.k + '</div>';
    }).join('');
    el.endscreen.classList.remove('off');
    setPrompt('');
    setReadout('');
    setCombo('');
  }
  function hideEnd() { el.endscreen.classList.add('off'); }

  global.UI = {
    init: init,
    caption: caption,
    clearCaption: clearCaption,
    setPrompt: setPrompt,
    setReadout: setReadout,
    setCombo: setCombo,
    setLamp: setLamp,
    setCity: setCity,
    showHUD: showHUD,
    flash: flash,
    letterbox: letterbox,
    fade: fade,
    actCard: actCard,
    buildChoice: buildChoice,
    hideChoice: hideChoice,
    hasChoice: hasChoice,
    resolveChoice: resolveChoice,
    showTitle: showTitle,
    showEnd: showEnd,
    hideEnd: hideEnd,
    el: el
  };
})(window);
