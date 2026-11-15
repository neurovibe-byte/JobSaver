// Landing page copy. Numbers come from our own measurements (see README "What it detects").

export const NAV_LINKS = [
  { href: '#features', label: 'Detections' },
  { href: '#how', label: 'How it works' },
  { href: '#alerts', label: 'Telegram alerts' },
  { href: '#faq', label: 'FAQ' },
]

export const STATS = [
  { value: '91%', label: 'of bare heads caught in our helmet test set' },
  { value: '~1 s', label: 'to confirm a violation and record it with a snapshot' },
  { value: '~40 ms', label: 'AI analysis per frame on a laptop GPU' },
  { value: '$0', label: 'licences: open models, free Telegram bot' },
]

export const DETECTIONS = [
  {
    key: 'helmet',
    title: 'No helmet',
    text: 'Finds every person’s head and checks for a hard hat. A bare head on site is flagged in about a second.',
    tag: 'Violation',
    tone: 'warn',
  },
  {
    key: 'zone',
    title: 'Danger zone entry',
    text: 'Draw a zone around a machine, edge or loading bay. Anyone who steps inside is recorded instantly.',
    tag: 'Violation',
    tone: 'warn',
  },
  {
    key: 'down',
    title: 'Person down',
    text: 'Body-pose tracking spots a worker lying on the floor for several seconds: a fall or loss of consciousness.',
    tag: 'Emergency',
    tone: 'danger',
  },
  {
    key: 'fire',
    title: 'Fire & smoke',
    text: 'An optional model watches every camera for flames and smoke and raises an emergency.',
    tag: 'Emergency · optional',
    tone: 'danger',
  },
  {
    key: 'vest',
    title: 'No safety vest',
    text: 'An optional model checks each worker’s torso for a hi-vis vest where one is required.',
    tag: 'Violation · optional',
    tone: 'warn',
  },
  {
    key: 'sos',
    title: 'One-tap SOS',
    text: 'Anyone at the control panel can raise a manual emergency with a live snapshot from the camera.',
    tag: 'Emergency',
    tone: 'danger',
  },
]

export const STEPS = [
  { title: 'Connect a camera', text: 'Laptop webcam, a phone’s front or back camera, an IP/CCTV stream, or a recorded video.' },
  { title: 'AI watches every frame', text: 'Open-source vision models check helmets, zones, falls and fire several times per second.' },
  { title: 'Incident is recorded', text: 'Each violation is saved with an annotated snapshot, camera, location and time.' },
  { title: 'Managers are alerted', text: 'A Telegram message with the photo and details reaches the right people instantly.' },
]

export const SOURCES = [
  { title: 'Laptop webcam', text: 'Start monitoring in seconds, right from the browser.' },
  { title: 'Phone camera', text: 'Front or back camera: turn any phone into a wireless safety camera.' },
  { title: 'IP & CCTV', text: 'Plug in existing RTSP/HTTP streams from site cameras.' },
  { title: 'Video files', text: 'Upload recordings to review incidents or run demos.' },
]

export const FAQ = [
  {
    q: 'Do I need to train my own AI model?',
    a: 'No. JobSaver uses free, pretrained open-source models: a hard-hat detector and a body-pose model, plus optional vest and fire models. You can swap in a fine-tuned model later if your site needs it.',
  },
  {
    q: 'How accurate is it?',
    a: 'On a labelled test set of 164 heads, the helmet check caught 91% of bare heads and wrongly flagged 2% of helmets. A violation must persist across several frames before it is recorded, which removes most one-off glitches. Accuracy depends on camera angle, distance and lighting, so test it on your own footage.',
  },
  {
    q: 'Does video go to the cloud?',
    a: 'No. Detection runs on your own computer or server. Only the alerts you choose (a snapshot and the details) are sent to your Telegram chats.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. The models are open source, Telegram bots are free, and it runs on hardware you already have. A laptop with a modern GPU handles several cameras.',
  },
  {
    q: 'How do Telegram alerts get set up?',
    a: 'Entirely in the app: paste a bot token from @BotFather, pick the chats that should receive alerts, choose which incident types to send, and press “Send test”.',
  },
]
