// What the participant sees on P18 when something stops working mid-interview: a plain description, the steps an AI guide
// walks them through, and a hint for one more try. The wording is mock, written per problem; the real guide would be AI-generated.

import type { IssueType } from './fieldwork'

export type SelfServiceIssue = {
  type: IssueType
  /** The screen's one-line headline. */
  headline: string
  /** What happened, in plain words. */
  plain: string
  /** What the guide says first, before the steps. */
  intro: string
  steps: string[]
  /** What the guide says when the first check fails and there is one more try. */
  retryHint: string
  /** What the guide says when the check passes. */
  fixed: string
}

export const SELF_SERVICE: SelfServiceIssue[] = [
  {
    type: 'Microphone permission denied',
    headline: 'We can’t hear you',
    plain: 'Your browser is blocking the microphone, so the interview can’t pick up what you say.',
    intro: 'This usually takes a minute. I’ll walk you through it, one step at a time.',
    steps: [
      'Tap the padlock or the settings icon next to the web address at the top of your browser.',
      'Find “Microphone” and change it to “Allow”.',
      'Come back to this page. If your browser asks to reload, say yes. Your answers so far are saved.',
    ],
    retryHint: 'Some phones also keep a separate microphone switch in the system settings. Check that this browser is allowed to use the microphone there, then try again.',
    fixed: 'That did it. I can hear you now.',
  },
  {
    type: 'Camera not detected',
    headline: 'We can’t see your camera',
    plain: 'The interview can’t find a working camera on your device.',
    intro: 'Let’s check the camera together. It only takes a moment.',
    steps: [
      'Close any other app or tab that might be using the camera, such as a video call.',
      'If you’re on a computer, check the camera is plugged in and not covered.',
      'Come back to this page and allow the camera when your browser asks.',
    ],
    retryHint: 'If the camera still can’t be found, try another browser (Chrome or Safari), or restart your device. Your answers are saved.',
    fixed: 'Your camera is working. Thanks for sticking with it.',
  },
  {
    type: 'Connection lost',
    headline: 'Your connection dropped',
    plain: 'We lost contact with your device for a moment. Your answers up to that point are saved.',
    intro: 'Don’t worry, nothing is lost. Let’s get you reconnected.',
    steps: [
      'Check you’re still on Wi‑Fi or mobile data, and that the signal is steady.',
      'If you can, move closer to your router, or switch between Wi‑Fi and mobile data.',
      'Come back to this page and we’ll pick up where you left off.',
    ],
    retryHint: 'Try closing other apps that use the internet, such as downloads or streaming, then try again.',
    fixed: 'You’re back online. We’ll pick up right where you left off.',
  },
  {
    type: 'Audio dropped',
    headline: 'The sound cut out',
    plain: 'The audio dropped for a moment, so part of your last answer may be missing.',
    intro: 'Let’s make sure the sound is working before you carry on.',
    steps: [
      'Check your device isn’t muted and the volume is turned up.',
      'If you’re using headphones, unplug them and plug them back in, or switch to your device’s own speaker.',
      'Come back to this page and tap Try again.',
    ],
    retryHint: 'If it keeps cutting out, move somewhere quieter with a steadier signal, and close other apps that use sound.',
    fixed: 'The sound is back. I’ll repeat the last question in case part of your answer was lost.',
  },
  {
    type: 'Video stream interrupted',
    headline: 'Your video stopped',
    plain: 'Your video feed stopped, so the interview can’t see you right now.',
    intro: 'Let’s get your video running again.',
    steps: [
      'Make sure the camera isn’t covered and no other app is using it.',
      'Turn your camera off and on again from the controls on screen, or reload this page.',
      'Come back to this page and tap Try again. Your answers are saved.',
    ],
    retryHint: 'Try moving closer to your router or switching to mobile data, since video needs a steady connection.',
    fixed: 'Your video is back. Thanks for your patience.',
  },
  {
    type: 'Unsupported browser or device',
    headline: 'This browser can’t run the interview',
    plain: 'The browser or device you’re using can’t run the interview properly.',
    intro: 'The fix is quick: we just need a browser the interview works with.',
    steps: [
      'Open this same link in Chrome, Safari or Edge.',
      'If you’re on a very old phone or tablet, try a laptop or a newer phone.',
      'Come back to this page and tap Try again.',
    ],
    retryHint: 'Make sure the browser is up to date, then open the link again.',
    fixed: 'That works. You’re all set.',
  },
]

export const selfServiceFor = (type: string | null | undefined) => SELF_SERVICE.find((x) => x.type === type)
