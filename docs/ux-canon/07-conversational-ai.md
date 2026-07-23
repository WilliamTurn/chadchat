# UX Canon 07 — Conversational and AI-Product UX

Scope: chat interfaces, composers, streaming, AI response affordances, conversation management, voice/dictation, human-AI interaction canon, AI trust and safety, proactive AI, latency/cost communication, AI onboarding, persona boundaries.

Sources abbreviated: **HAX** = Microsoft Guidelines for Human-AI Interaction (18 guidelines, haxtoolkit); **PAIR** = Google People + AI Guidebook; **NN/g** = Nielsen Norman Group AI-UX research 2023–2026; **Apple HIG** = Apple Human Interface Guidelines (Machine Learning, Generative AI, Siri/Dictation); **Material** = Google Material conversation patterns; **Converged** = the observable agreement of ChatGPT, Claude, and Gemini production interfaces (all three agreeing is treated as consensus).

Tag: [mechanical] = checkable without taste; [judgment] = requires design judgment to apply.

---

## A. Message list and chat layout

1. **Order messages chronologically, newest at the bottom.** Chat reads top-to-bottom like a transcript; the newest message is always adjacent to the composer. Every mainstream messenger and AI chat does this; do not invert it. — [Material, Converged] — [mechanical]

2. **Visually distinguish the user's messages from the AI's at a glance.** Users must never have to read a message to know who said it. Use alignment, background, avatar, or label so authorship is instantly scannable. — [Material, HAX G1-adjacent, Converged] — [mechanical]

3. **Give user messages a contained bubble; let long AI answers run full-width or near-full-width.** All three leading AI products converged on this asymmetry: short user turns read as bubbles, long generated answers read as documents. Symmetric bubbles cramp AI output; two full-width columns lose the conversational feel. — [Converged (ChatGPT, Claude, Gemini)] — [judgment]

4. **Render AI output as rich formatted text, not raw plaintext.** Markdown headings, lists, bold, tables, and syntax-highlighted code blocks render as such. A wall of unformatted text from a model is a defect in 2026. — [Converged, NN/g (scannable responses)] — [mechanical]

5. **Give code blocks their own affordances: monospace, syntax highlight, copy button, horizontal scroll.** Code inside a response is a distinct object users act on (copy, compare). It must never wrap destructively or overflow the page. — [Converged] — [mechanical]

6. **Constrain line length of AI responses on wide screens.** Full-browser-width paragraphs are unreadable; all three leading products cap the conversation column (~65–80ch). — [Converged; typography canon] — [mechanical]

7. **Group consecutive messages from the same author; don't repeat the avatar/name on every line.** Grouping reduces noise and makes turn-taking legible. Show identity once per turn cluster. — [Material, Converged messengers] — [mechanical]

8. **Show timestamps on demand or at low prominence, not on every message.** In human-messaging, day dividers plus tap/hover-to-reveal is the norm. AI chats deprioritize timestamps further (conversation list shows recency instead); never let timestamps compete with content. — [Material, Converged] — [judgment]

9. **Insert day/session dividers when a conversation spans days.** Users returning to an old thread need temporal orientation before they resume it. — [Material messenger canon] — [mechanical]

10. **Keep the full transcript scrollable and intact; never silently truncate visible history.** Users treat the transcript as a record. If context is dropped from the model, that is backstage; the visible transcript must not lose messages without the user deleting them. — [Converged; HAX G16 (remember recent interactions)] — [mechanical]

11. **Support text selection and copying anywhere in the transcript.** Chat content is working material; disabling selection or making bubbles swallow selection is a defect. — [Converged] — [mechanical]

12. **Make the chat surface responsive down to small phones: bubbles wrap, tables and code scroll internally, nothing overflows the viewport.** Wide artifacts (tables, code) get their own horizontal scroll container inside the message. — [Converged; responsive canon] — [mechanical]

13. **Show the AI's identity/name and the model or mode in use where it matters.** When a product offers multiple models/modes, the current one is visible near the conversation (header or composer), and each response is attributable to the model that produced it. — [Converged (model pickers in all three)] — [judgment]

## B. Scroll behavior

14. **Open a conversation scrolled to the newest message.** The bottom is the "now" of a chat; landing anywhere else disorients. Provide an instant path back to recent context if the user was deep-linked elsewhere. — [Material, Converged] — [mechanical]

15. **Anchor to the bottom only while the user is already at the bottom.** If the user has scrolled up to read history, new content or streaming tokens must NOT yank the viewport down. Auto-follow is a state the user exits by scrolling up. — [Converged; NN/g] — [mechanical]

16. **When auto-follow is off and new content arrives, show a "jump to latest / new messages" affordance.** A pill or arrow near the composer tells the user there is new content below and takes them there in one tap. — [Material, Converged messengers] — [mechanical]

17. **Preserve scroll position when history loads above (infinite scroll upward).** Prepending older messages must not visually shift what the user is reading; anchor the viewport to the message they were on. — [Material; virtualized-list canon] — [mechanical]

18. **During streaming, keep the text the user is reading stationary.** Either follow the growing tail smoothly (user at bottom) or freeze the viewport (user reading above); never oscillate, and never let layout shifts from late-rendering elements (images, tables) jump the page. — [Converged; CLS canon] — [mechanical]

19. **Scrolling up must never be hijacked to trigger actions.** Reading history is the most common gesture in chat; reserve it purely for scrolling (no pull-to-refresh collisions, no reveal gestures on the same axis without care). — [Material; mobile canon] — [judgment]

## C. Composer

20. **Pin the composer to the bottom of the chat, always reachable.** It never scrolls away with the transcript and stays above the on-screen keyboard on mobile (respect safe areas and keyboard insets). — [Material, Converged] — [mechanical]

21. **Grow the input vertically as the user types, up to a capped height, then scroll internally.** Single-line inputs that hide multi-line prompts are a defect; unbounded growth that eats the transcript is too. All three leading products cap around 6–10 lines. — [Converged] — [mechanical]

22. **Provide a visible send button in addition to the keyboard shortcut.** Mobile users and mouse users need a tap target; keyboard users get Enter. The send button reflects state: disabled/neutral when empty, active when sendable. — [Material, Converged] — [mechanical]

23. **Desktop: Enter sends, Shift+Enter inserts a newline. Mobile: the return key inserts a newline and the send button sends.** This is the converged convention of every major chat product; deviating breaks deep muscle memory. Boundary note (2026-07-22): this rule is scoped to chat composers only. Document- and form-style multi-line textareas are the opposite — plain Enter never submits there; Cmd/Ctrl+Enter is the optional submit accelerator (canon 01 §B.24). Scoped this way, the two rules do not conflict. — [Converged] — [mechanical]

24. **Use placeholder text in the composer to hint capability, not to state the obvious.** "Message Chad" or a capability hint beats "Type here…". Placeholder is a discovery surface (see §P). — [NN/g chatbot guidelines, Converged] — [judgment]

25. **Never lose a drafted message.** Navigating away and back, switching conversations, backgrounding the app, or an app update must preserve composer drafts. Losing user-typed text is among the most-hated failures in chat UX. — [Converged messengers; forms canon] — [mechanical]

26. **Keep the composer usable while the AI is responding, or make the block explicit.** Converged behavior: users can type the next message during streaming; if sending is deferred or disabled until generation ends, the state is visible (send morphs to stop). Silently dropping input typed during generation is a defect. — [Converged] — [mechanical]

27. **If there is an input length/token limit, surface it before the user hits it.** Show a counter as the limit approaches and never silently truncate what the user wrote. If pasted content exceeds the limit, say so and offer options (e.g., attach as file). — [HAX G2-adjacent; forms canon; Converged (ChatGPT/Claude convert long pastes to attachments)] — [mechanical]

28. **Support paste-rich input: long text, images from clipboard, files.** Users paste screenshots and documents into AI chats as a primary workflow; the composer accepts them and previews them as removable chips before send. — [Converged] — [mechanical]

29. **Let the user edit with full text-editing affordances.** Cursor placement, selection, undo within the composer, spellcheck. The composer is a real text editor, not a command line. — [platform canon] — [mechanical]

## D. Attachments and multimodal input

30. **Expose attachment capability with a visible affordance (paperclip/plus) in the composer.** If the AI accepts images/files, users must be able to discover it without being told; drag-and-drop alone is not discoverable on mobile. — [Converged; HAX G1] — [mechanical]

31. **Preview attachments before sending, with per-item remove.** Thumbnails for images, name+type chips for files; the user can inspect and delete each before committing. — [Converged] — [mechanical]

32. **State file constraints at the point of attachment failure, not in documentation.** Wrong type, too large, too many: the error names the constraint ("PDFs up to 30 MB") and what to do instead. — [forms/error canon; HAX G9-adjacent] — [mechanical]

33. **Show upload/processing progress on attachments and block send until they are usable, with a visible reason.** A send that silently fires before the file is processed produces confusing model answers ("I don't see a file"). — [Converged] — [mechanical]

34. **On mobile, offer camera and photo library as first-class attachment paths.** Mobile users' documents are photos; forcing a file-picker-only path is desktop bias. — [Apple HIG, Material] — [judgment]

## E. Streaming responses and generation control

35. **Stream responses token-by-token rather than waiting for the full answer.** Progressive rendering is the single biggest perceived-latency win in AI UX and is universal across leading products. The user starts reading (and can abort) immediately. — [Converged; NN/g; PAIR (latency)] — [mechanical]

36. **Show a thinking/typing indicator between send and first token.** The gap before streaming begins must be visibly "the AI is working," not a dead screen: shimmer, animated dots, or a status line, appearing within ~100ms of send. — [Converged; feedback canon] — [mechanical]

37. **Target a short time-to-first-token and mask what you can't eliminate.** Sub-second first token feels conversational; multi-second gaps need staged status ("Searching…", "Reading files…"). Perceived latency is managed with communication when it can't be engineered away. — [NN/g; PAIR; Converged] — [judgment]

38. **Always provide a Stop control during generation.** The send button converts to a stop button (or a stop control appears) for the entire duration of generation. Users must be able to abort a bad or runaway answer instantly; the partial output stays in the transcript. — [Converged (all three); HAX G17 (efficient dismissal/correction)] — [mechanical]

39. **Render streamed markdown progressively without flicker.** Partial markdown (an unclosed code fence, a half-built table) must not flash broken syntax; buffer or progressively upgrade formatting so the stream reads cleanly. — [Converged] — [mechanical]

40. **When the AI performs intermediate steps (searching, running tools, reading files), narrate them as visible status.** Agentic latency without narration reads as a hang; each step gets a short human-readable label, collapsible after completion. — [Converged (all three show tool/search steps); HAX G11 (make clear why the system did what it did)] — [mechanical]

41. **If "extended thinking"/reasoning happens before the answer, show that it is happening and roughly what stage it's at.** A distinct "thinking" state (optionally expandable) prevents users from concluding the app froze. — [Converged (ChatGPT o-series, Claude, Gemini all show thinking states)] — [mechanical]

42. **Interrupted or failed generations leave an honest artifact.** A stopped response is marked as stopped; a network-failed response shows an inline error with a Retry that reuses the same prompt. Never leave a half-answer that looks complete. — [Converged; error canon] — [mechanical]

43. **Never let the interface allow double-submission of the same prompt through impatience.** While a response is generating for a message, re-send of that message is impossible; regenerate is an explicit, separate action. — [feedback canon] — [mechanical]

## F. Latency, cost, and long-running work

44. **Distinguish "seconds" waits from "minutes" waits with different UI.** In-conversation spinners are for seconds. Long generations (deep research, video, large jobs) get a persistent task representation: progress or stage indicator, the ability to leave and return, and notification on completion. — [PAIR; Converged (deep-research modes notify on completion)] — [judgment]

45. **Let users leave a long-running AI task without killing it.** Backgrounding, navigating away, or closing the panel must not abort minutes-long work; the job survives and announces completion (badge, notification, or inbox). — [Converged] — [mechanical]

46. **Communicate queue/overload states honestly.** "High demand — responses may be slower" beats silent degradation. If the user is rate-limited, say what the limit is and when it resets. — [HAX G2; Converged (all three show rate-limit/reset messaging)] — [mechanical]

47. **Make usage limits and metering visible before they interrupt.** If messages/generations are metered (free tiers, credits), show remaining allowance near the composer or in account settings, and warn before the last unit, not after. — [Converged; trust canon] — [mechanical]

48. **When hitting a paywall mid-conversation, preserve the conversation and the draft.** Upsell interstitials must never destroy context; after upgrading (or dismissing), the user returns exactly where they were. — [commerce canon; Converged] — [mechanical]

## G. AI response affordances

49. **Attach a persistent action row to every AI response: copy, regenerate/retry, feedback.** These are the converged minimum. They live at the response's edge, discoverable on hover (desktop) and persistent or on-tap (mobile). — [Converged (all three)] — [mechanical]

50. **Copy copies clean text/markdown, not UI furniture.** Copying a response excludes buttons, avatars, and citation chrome; code-block copy copies exactly the code. — [Converged] — [mechanical]

51. **Regenerate produces a new attempt without destroying the old one.** Converged pattern: alternatives become navigable versions (\< 2/3 \>) rather than overwriting. At minimum, the user must not lose an answer they may have preferred. — [Converged (ChatGPT, Claude version arrows); HAX G8-adjacent] — [mechanical]

52. **Let users edit their own earlier message and rerun from that point.** Editing a prompt is the primary repair loop in AI chat (NN/g: users iterate rather than start over). Show that downstream turns will be superseded, and keep prior branches reachable where the product supports branching. — [Converged; NN/g accordion editing/apple picking] — [mechanical]

53. **Feedback controls (thumbs up/down) are lightweight, optional, and acknowledged.** One tap records it; thumbs-down may ask one optional follow-up ("What was wrong?") but never a mandatory form. Acknowledge receipt and, where true, say feedback improves the product. — [HAX G15 (encourage granular feedback); PAIR (Feedback + Control); Converged] — [mechanical]

54. **Never use feedback UI as a decoy.** If thumbs data goes nowhere, don't show thumbs. Visible feedback affordances imply a learning loop; faking one erodes trust when behavior never changes. — [PAIR; HAX G13/G15 spirit] — [judgment]

55. **Make long responses scannable and controllable in length.** Users routinely ask AI to expand/compress ("accordion editing"); support it via response style (headings, TL;DR first) and, where offered, explicit length/tone controls rather than forcing prompt gymnastics. — [NN/g (accordion editing, response outlining); Converged (Gemini "modify response", ChatGPT custom instructions)] — [judgment]

56. **Provide share/export for conversations or responses where content has value outside the chat.** Converged: share links, export, or copy-as-document. Sharing shows a preview of exactly what becomes visible and to whom. — [Converged; privacy canon] — [mechanical]

57. **Tables, artifacts, and generated files get open/download affordances, not screenshot-only existence.** If the AI makes a thing (document, image, code file), the user can get the thing out. — [Converged] — [mechanical]

## H. Citations and sources

58. **When the AI asserts facts drawn from retrieval/search, show sources.** Cited claims are the converged trust mechanism for grounded answers: inline markers or chips linking to the source, plus a source list. — [Converged (all three cite when browsing); HAX G2; NN/g] — [mechanical]

59. **Citations point to the specific supporting location, and clicking one never destroys the conversation.** Open sources in a side panel, new tab, or in-place preview; the chat context is preserved. — [Converged] — [mechanical]

60. **Visually distinguish grounded statements from model-generated prose where the product mixes both.** Users must be able to tell "this came from your document/the web" from "the model composed this." — [PAIR (Explainability + Trust); Apple HIG ML (Attribution)] — [judgment]

61. **Never fabricate the appearance of citation.** A numbered reference must resolve to a real, checkable source. Decorative or broken citations are worse than none: they exploit the exact trust signal users rely on. — [NN/g; trust canon] — [mechanical]

## I. Conversation management

62. **Persist conversation history by default and make it browsable.** A sidebar/list of past conversations ordered by recency, with the current one highlighted, is the converged pattern. Ephemeral-by-default chat destroys user work. — [Converged] — [mechanical]

63. **Auto-title conversations from their content, and let users rename.** Users won't title threads themselves; generate a short title after the first exchange, editable via rename. — [Converged (all three auto-title)] — [mechanical]

64. **Provide search across conversation history.** Once users have dozens of threads, recency browsing fails; full-text search over past conversations is now table stakes in leading products. — [Converged] — [mechanical]

65. **Make "start a new conversation" one always-visible action.** New-chat is the most common navigation act in AI products; it is one tap/click from anywhere, and never destroys the previous thread (which remains in history). — [Converged] — [mechanical]

66. **Help users choose continue-vs-fresh where it matters.** Long threads degrade model quality; leading products nudge ("start a new chat for a new topic") or summarize-and-continue. At minimum, never punish users silently for long threads they don't know are a problem. — [Converged (context-limit notices); HAX G2] — [judgment]

67. **Deletion is available per-conversation and in bulk, with confirmation and honest scope.** Say what deletion does (removed from your history; whether copies persist for safety/training and for how long). Deleting must be reachable from the conversation list. — [Converged; privacy canon] — [mechanical]

68. **Pin/favorite and organize (folders/projects) once history scales.** Recency alone stops working for power users; converged products added pinning and project grouping. For a young product this can wait, but search and rename cannot. — [Converged (projects/Gems/pinning)] — [judgment]

69. **Sync conversation state across devices.** A thread started on the phone is available on the desktop, at the same read position, without user action. Cross-device continuity is expected of any account-based chat. — [Converged] — [mechanical]

70. **Distinguish temporary/incognito chats visibly if offered.** If a mode doesn't save history or isn't used for training, mark the whole conversation surface as such while active. — [Converged (ChatGPT temporary chat, Gemini incognito-adjacent)] — [mechanical]

## J. Voice input and dictation

71. **Give dictation a visible start affordance (mic icon) in or beside the composer.** Voice input is discovered visually; a mic in the composer is the converged placement. — [Apple HIG (Dictation), Material, Converged] — [mechanical]

72. **Make recording state unmistakable: distinct visuals, live level/waveform feedback, and an obvious stop.** The user must always know the mic is hot. An animated waveform or level meter confirms audio is being captured; a static icon that secretly records is a trust violation. — [Apple HIG; platform canon; Converged] — [mechanical]

73. **Provide an explicit stop/done affordance separate from send, plus a cancel that discards.** Converged mobile pattern: stop ends capture and shows the transcript for review; a distinct cancel (X) throws the audio away. Never auto-send the instant the user stops talking unless the product is explicitly hands-free. — [Apple HIG; Converged] — [mechanical]

74. **Show live transcription as the user speaks, streamed into the composer.** Seeing words appear confirms both capture and recognition quality in real time and lets the user abort early when recognition is failing. — [Apple HIG Dictation; Converged] — [mechanical]

75. **Route dictation output through the editable composer, not straight to the model.** Dictation is input, and input is correctable: the user can fix mis-recognitions with the keyboard before sending. (Full voice-conversation modes are the explicit exception, clearly a different mode.) — [Apple HIG (Corrections); Converged] — [mechanical]

76. **Handle silence and noise failure gracefully with next steps.** "I didn't catch that" states offer retry and a typed fallback; repeated failure suggests the keyboard rather than looping. Never blame the user. — [Apple HIG Siri patterns; PAIR (Errors + Graceful Failure); HAX G9] — [mechanical]

77. **Ask for microphone permission in context with a reason, and handle denial with a working fallback.** Request the mic on first tap of the mic button (not at app launch), explain why, and keep typing fully functional if denied — with a path to re-enable in settings. — [Apple HIG, Material permission canon] — [mechanical]

78. **Choose push-to-talk vs toggle deliberately and signal which it is.** Hold-to-record and tap-to-toggle are both legitimate; the affordance must telegraph the model (a held button that ends on release vs a state toggle), and accidental releases in hold-mode shouldn't destroy a long utterance. — [contested in placement, but signaling requirement is consensus; Apple HIG] — [judgment]

79. **In hands-free/live voice modes, show listening/thinking/speaking states and support barge-in.** Full-duplex voice UIs (ChatGPT/Gemini voice modes) display which state the assistant is in and allow the user to interrupt the AI mid-speech. Provide mute and an exit back to text. — [Converged voice modes; Amazon/Google voice canon] — [mechanical]

80. **Respect the audio environment: play assistant speech through expected channels, duck other audio, and honor the ringer/silent switch conventions of the platform.** — [Apple HIG] — [mechanical]

## K. Expectation setting and capability communication (human-AI canon)

81. **Make clear what the system can do.** The first-run and empty states communicate the AI's capabilities concretely (see §P); vague "Ask me anything" framing produces failed first prompts and abandonment. — [HAX G1; NN/g chatbot guidelines; PAIR (Mental Models)] — [judgment]

82. **Make clear how well the system does it.** Communicate quality limits honestly: beta labels where true, domain limits ("I can't see your medical records"), and the standing fallibility disclosure (see #85). Overpromising intelligence is the root cause of AI-product trust collapse. — [HAX G2; PAIR; Apple HIG ML (Limitations)] — [judgment]

83. **Always make clear when the user is talking to an AI, not a human.** Disclose bot-ness up front in any context where confusion is possible (support chat especially). Impersonating a human is both a dark pattern and, increasingly, illegal. — [NN/g; EU AI Act transparency; industry consensus] — [mechanical]

84. **Distinguish AI-generated content from system/UI text and from human-authored content.** The user must be able to tell "the model said this" from "the app says this" (errors, billing, policies are system voice — see §Q) and from any human-sourced content in the product. — [HAX; Apple HIG (generative AI labeling); emerging regulation] — [mechanical]

85. **Carry a standing "AI can make mistakes" disclosure near the conversation.** Converged placement: a persistent short line under the composer or response area ("Chad can make mistakes. Check important info."), not a one-time dismissed modal. It supplements, never replaces, in-context uncertainty signals. — [Converged (all three); NN/g] — [mechanical]

86. **Scope the AI's claimed competence to its actual grounding.** If the model can't see the user's account data, live prices, or today's date, it must not imply it can; when asked for out-of-scope things, say what it can't do AND redirect to what it can. — [HAX G1/G2; PAIR; NN/g chatbot guidelines] — [judgment]

87. **State knowledge-cutoff and data-freshness where stale answers mislead.** If answers derive from a model with a training cutoff (no live retrieval), time-sensitive answers disclose it; products with browsing show when they searched. — [Converged; HAX G2] — [mechanical]

88. **Match capability claims in marketing to in-product reality.** The gap between advertised AI and experienced AI is a first-session trust killer; capability communication is one surface spanning store listing, onboarding, and empty states. — [PAIR (set expectations); NN/g] — [judgment]

## L. Uncertainty, errors, and graceful failure

89. **Communicate uncertainty in the answer itself when confidence is low.** Hedged phrasing, explicit "I'm not sure — verify X," or confidence framing beats false fluency. Calibrated language is the model-side half; the product-side half is making verification easy (citations, links). — [PAIR (Explainability + Trust); Apple HIG ML (Confidence); HAX G2] — [judgment]

90. **When the AI fails or can't help, support efficient recovery, not a dead end.** Failed generation → retry; wrong answer → edit-and-rerun or regenerate; misunderstood request → the AI asks a clarifying question rather than guessing on genuinely ambiguous input. Every failure state names a next step. — [HAX G8/G9; PAIR (Errors + Graceful Failure)] — [mechanical]

91. **Refuse harmful or out-of-policy requests respectfully, briefly, and without moralizing at the user.** State that it can't help with that, offer an adjacent legitimate alternative where one exists, and move on. Lecturing, shaming, or refusing vaguely ("something went wrong") are all failures. — [industry consensus (Anthropic/OpenAI/Google policy UX); HAX G9] — [judgment]

92. **Never present a refusal as a technical error, or an error as a refusal.** "I can't help with that" (policy), "Something went wrong, try again" (system), and "I don't know" (capability) are three different states; mislabeling them destroys the user's mental model. — [HAX G2/G11; error canon] — [mechanical]

93. **Degrade gracefully when AI services are down: keep the rest of the app working and say the AI is unavailable.** AI-feature outage must not brick non-AI surfaces, and the outage message is specific ("assistant temporarily unavailable"), with history still readable. — [resilience canon; PAIR] — [mechanical]

94. **Bound retries and loops.** If the model repeatedly fails the same request, escalate the messaging (suggest rephrasing, different approach, or human support) rather than letting the user grind the same failure. — [PAIR (Errors); NN/g chatbot research] — [judgment]

## M. User control, correction, and learning loops

95. **The user can always correct the AI, and correction visibly takes effect.** In-conversation corrections ("no, I meant…") must be honored in subsequent turns; remembered facts the user corrects stay corrected. — [HAX G13 (learn from user behavior), G17; Apple HIG ML (Corrections)] — [judgment]

96. **Make AI memory/personalization inspectable and editable.** If the assistant remembers things about the user across sessions, provide a place to view, edit, and delete those memories, and signal in-the-moment when something was saved ("Memory updated"). — [Converged (ChatGPT/Gemini/Claude memory UIs all expose this); HAX G16; PAIR (Feedback + Control)] — [mechanical]

97. **Offer global controls over AI behavior where behavior is adaptive.** Custom instructions/system preferences (tone, format, persona intensity) live in settings; users can turn adaptive features off entirely. — [HAX G17 (global controls); Converged] — [mechanical]

98. **Update and adapt cautiously; don't change behavior out from under the user.** Model upgrades or behavior changes that alter the product's personality or capability get release notes or in-product notice, not silent switcheroo. — [HAX G18 (notify about changes); PAIR] — [judgment]

99. **Keep the human in control of consequential actions.** The AI drafts, the user commits: anything that sends, buys, deletes, or publishes on the user's behalf requires explicit user confirmation with a preview of exactly what will happen, and is undoable where possible. — [PAIR; HAX; agent-UX consensus 2025–2026] — [mechanical]

100. **Show what an agent did after it acted.** Autonomous/tool-using steps produce a reviewable log (what was read, what was changed) so the user can audit and reverse. — [HAX G11; agent-product convergence] — [mechanical]

## N. AI trust, safety, and data transparency

101. **Tell users what happens to their conversations: storage, human review, and training use — and give an opt-out where training on user data occurs.** Converged products expose a "improve the model for everyone" toggle and document review practices. Burying this only in a policy PDF fails the norm. — [Converged; PAIR (Data Collection); GDPR/AI-regulation baseline] — [mechanical]

102. **Warn users against sharing sensitive data where the risk is real, at the moment it's relevant.** E.g., a note in a health/finance AI context or on first use: don't paste passwords, don't rely on the AI for emergencies. — [NN/g; industry consensus] — [judgment]

103. **Place hallucination-risk disclosure where the risk is consumed, scaled to stakes.** The standing footer (#85) covers the general case; high-stakes domains (medical, legal, financial dosage/amounts) add in-context caveats and pointers to authoritative sources on the specific answer. — [Converged; NN/g; regulated-domain consensus] — [judgment]

104. **Mitigate and never amplify social bias in AI output, and provide a report path.** Language and suggestions avoid stereotyping; a "report this response" affordance exists for harmful output beyond a thumbs-down. — [HAX G6; PAIR; RAI consensus] — [mechanical]

105. **Age-gate and content-safety-gate AI features to the product's audience.** An AI with an edgy persona still enforces the platform's content standards and any age requirements; persona is not a safety exemption. — [platform policy consensus (App Store/Play AI rules)] — [mechanical]

106. **Label AI-generated media as AI-generated when it leaves the product.** Shared images/audio/video generated by AI carry provenance labeling (visible and/or metadata like C2PA) per emerging platform norms. — [industry consensus 2024–2026; regulation] — [mechanical]

## O. Proactive AI and interruption etiquette

107. **Time proactive suggestions to context, and default to unobtrusive.** An assistant may surface a suggestion when the user's current task makes it relevant (HAX G3/G4); it appears as a dismissible, ignorable element — never a modal that steals focus from user work. — [HAX G3/G4/G5; Apple HIG (proactive suggestions)] — [judgment]

108. **Proactive AI content earns notifications only with explicit opt-in, and respects notification etiquette.** AI-initiated pings (daily summaries, "I noticed…") are off by default, individually controllable, batched, and quiet-hours-aware. An AI that notifies to drive engagement rather than user value is a dark pattern. — [notification canon; Converged (AI notification settings are granular)] — [mechanical]

109. **Dismissal is remembered.** A dismissed suggestion of a given type recurs less or never; repeat-nagging after explicit dismissal violates HAX G17 and trains users to ignore the assistant. — [HAX G12/G17] — [mechanical]

110. **Proactive suggestions show their trigger.** "Based on your last workout…" — the user can see why the AI piped up (scrutability), and can say "don't suggest this again." — [HAX G11; PAIR] — [judgment]

111. **Never let proactive AI interrupt mid-input or mid-task with focus-stealing UI.** Suggestions wait for pause points; interrupting typing/mid-flow with an AI popover is a canonical anti-pattern. — [HAX G3; interruption canon] — [mechanical]

## P. Onboarding and capability discovery

112. **Replace the empty conversation state with concrete example prompts.** 3–6 tappable starter prompts scoped to what the product is actually good at; tapping one runs it (or fills the composer). This is the converged empty-state pattern and doubles as capability disclosure (HAX G1). — [Converged (all three); NN/g chatbot guidelines] — [mechanical]

113. **Teach by doing, not by tour.** Capability onboarding happens through suggested first actions and just-in-time hints, not a multi-screen lecture before first use. Get the user to a first valuable AI response as fast as possible. — [PAIR (Mental Models); onboarding canon] — [judgment]

114. **Surface advanced capabilities progressively.** Attachments, voice, modes, and tools get just-in-time discovery (a one-time hint when relevant, a "new" badge) rather than an upfront wall; power features live behind stable, visible affordances. — [progressive disclosure canon; Converged] — [judgment]

115. **Lower the articulation barrier.** Most users are not good at prompting; provide structure where free text alone underserves: starter prompts, follow-up suggestion chips after responses, templates, and forms-plus-chat hybrids for structured tasks. — [NN/g (articulation barrier); Converged (suggestion chips in all three)] — [judgment]

116. **Suggested follow-ups must be genuinely likely next steps, not engagement bait.** Post-response chips ("Make it shorter", "Show a plan") continue the user's task; generic or self-promotional chips train users to ignore them. — [NN/g; HAX G5] — [judgment]

117. **Announce new AI capabilities in-product, once, dismissibly.** Feature drops get a small "what's new" moment tied to where the feature lives; capability change without announcement violates HAX G18, but repeated modals violate interruption norms. — [HAX G18; Converged] — [mechanical]

## Q. Persona and voice boundaries

118. **A strong AI persona lives ONLY in the conversation; system chrome speaks in neutral product voice.** Buttons, navigation, settings, errors, billing, legal, empty-state labels, and notifications use clear neutral language. The persona speaking from a delete-confirmation or an invoice is a category error: users need unambiguous system communication for consequential acts. — [Converged (all three: playful assistant, neutral chrome); NN/g; Apple HIG] — [mechanical]

119. **Persona never compromises clarity of state.** Jokes must not obscure whether something worked, failed, or was refused; error and safety messages are persona-free or persona-light so meaning survives. — [NN/g; error canon] — [judgment]

120. **Persona intensity is user-adjustable or at least consistent.** If the persona is harsh/comic, keep it consistent within conversation and consider a tone setting; unpredictable persona swings read as broken. — [Converged (tone/style settings); HAX G14 (update cautiously)] — [judgment]

121. **The AI does not claim feelings, embodiment, or human identity it doesn't have.** Persona can be vivid without asserting sentience or lying about being an AI (see #83); when asked directly "are you human/do you feel," it answers honestly. — [industry consensus; NN/g] — [mechanical]

122. **Emotional-support boundaries are designed, not improvised.** If users bring crisis-level content, the product responds with prepared, neutral-voice resources (hotlines, professional help) that override persona entirely. — [industry consensus (all major assistants); safety canon] — [mechanical]

123. **Anthropomorphize deliberately and sparingly.** Names, avatars, and "typing" cues raise expectations of human-level understanding (PAIR: mental-model inflation); every anthropomorphic signal added must be matched by actual capability or tempered by expectation-setting. — [PAIR (Mental Models); NN/g] — [judgment]

---

## Cross-references (owned by other agents)

- **Feedback/states agent:** spinners, skeletons, optimistic UI, generic error-state anatomy — this file covers only their AI-specific forms (streaming, thinking states, generation errors).
- **Interaction/forms agent:** general input ergonomics, keyboard handling, undo canon; composer specifics (#20–29) are the AI-specific overlay.
- **Navigation/flows agent:** sidebar/list navigation patterns behind conversation history (#62–69); deep-linking into threads.
- **Accessibility agent:** screen-reader live-region announcements for streaming text, focus management on new messages, captions for voice modes, reduced-motion for waveforms/shimmers — all AI surfaces here must also pass that agent's rules.
- **Performance/mobile/trust agent:** general latency budgets, offline behavior, permission-prompt etiquette (mic prompt #77 overlaps), general data-privacy disclosure patterns (#101 overlaps).
- **Visual/content agent:** typography of chat (line length #6 overlaps), microcopy voice rules (persona boundary #118 is the AI-specific extension).

## Contested / no-consensus

- **Bubbles vs full-width for AI answers on desktop:** the asymmetric convention (#3) is converged, but exact treatment (Claude's flat text vs ChatGPT's subtle container) varies; no pixel-level consensus.
- **Enter-to-send on desktop for long-form work:** power users of writing-heavy tools sometimes prefer Enter=newline; converged default is Enter=send (#23), but products aimed at long composition legitimately flip it or make it a setting. [contested]
- **Auto-send after dictation stop:** messaging apps and hands-free modes auto-send; assistant/dictation canon reviews first (#73/#75). The right default depends on product context. [contested]
- **Numeric confidence scores:** showing percentages ("87% confident") is NOT consensus — research repeatedly shows users misread them; calibrated language + citations is the converged practice, numeric display remains contested. [contested]
- **Thumbs-up presence:** some research argues only thumbs-down is actionable; all three leading products still ship both. Keep both, but this is convention, not validated science. [contested]
- **Visible chain-of-thought:** whether to expose raw reasoning (expandable thinking) vs summaries only is unsettled; products differ and are actively changing. [contested]
- **Proactive AI initiating first contact (messaging the user unprompted with generated content):** emerging in 2025–2026 products, no established norm beyond opt-in + notification etiquette (#108). [contested]
- **In-chat ads/sponsored content inside AI answers:** no consensus norm exists yet; treat as high-risk to trust. [contested]
- **Token/character counters always-visible vs on-approach:** consensus is only "never silently truncate" (#27); when to show the counter is style. [contested]
