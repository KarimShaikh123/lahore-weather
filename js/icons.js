(function () {
  const ICONS = {
    clear:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    partly:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M9 2.5v1.5M2.5 8h1.5M4.3 3.8l1 1M4.3 12.2l1-1"/><path d="M16.5 19h-9a3.5 3.5 0 0 1 .5-6.9 5 5 0 0 1 9.6-1A3.8 3.8 0 0 1 16.5 19z"/></svg>',
    cloud:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/></svg>',
    fog:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/><path d="M5 17.5h14M5 20.5h10"/></svg>',
    drizzle:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/><path d="M8 16l-1 2M12 16l-1 2M16 16l-1 2"/></svg>',
    rain:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/><path d="M7 16l-1.5 3M12 16l-1.5 3M17 16l-1.5 3"/></svg>',
    snow:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/><circle cx="8.5" cy="17.5" r=".9"/><circle cx="12.5" cy="17.5" r=".9"/><circle cx="16.5" cy="17.5" r=".9"/></svg>',
    showers:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="7" r="2.6"/><path d="M9 2.5v1M4 7h1M5.2 3.7l.8.8"/><path d="M17 12H10a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 8.6-1A3 3 0 0 1 17 12z"/><path d="M8 16l-1 2M13 16l-1 2"/></svg>',
    "snow-showers":
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="9" cy="7" r="2.6"/><path d="M9 2.5v1M4 7h1M5.2 3.7l.8.8"/><path d="M17 12H10a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 8.6-1A3 3 0 0 1 17 12z"/><circle cx="9.5" cy="17" r=".9"/><circle cx="13.5" cy="17" r=".9"/></svg>',
    thunder:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><path d="M17 13.5H7a4.5 4.5 0 0 1 .9-8.9A7 7 0 0 1 17 5.3a4.3 4.3 0 0 1 0 8.2z"/><path d="M12 13.5l-2 4h3l-2 4"/></svg>',
    unknown:
      '<svg viewBox="0 0 24 24" class="wi" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>',
  };

  if (typeof window !== "undefined") window.LW_ICONS = ICONS;
  if (typeof module !== "undefined" && module.exports) module.exports = ICONS;
})();