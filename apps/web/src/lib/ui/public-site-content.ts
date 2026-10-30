import publicPageMetadata from './public-pages.json';
// Public copy lives here so it can be edited without digging through the layout.
export const site = {
  name: 'Pass the Canvas',
  tagline: 'Make something. Together.',
  invitation: 'A little paint. A few friends. Absolutely no idea what happens next.',
  description: 'An online art party for people who make art. And people who think they don’t.',
  // Reuse the owner's verified support and contact destinations.
  contactUrl: 'https://tapps.design/#contact',
};
export const supportOptions = [
  { name: 'Cash App', handle: '$therealtapps', url: 'https://cash.app/$therealtapps' },
  { name: 'Venmo', handle: '@tracyapps', url: 'https://venmo.com/u/tracyapps' },
  { name: 'PayPal', handle: '@tapps', url: 'https://www.paypal.com/paypalme/tapps' },
];
export const navigation = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/gallery', label: 'The gallery' },
  { href: '/roadmap', label: 'On the workbench' },
];
export const pages: Record<string, { title: string; description: string }> = publicPageMetadata;
export const partySteps = [
  { number: '01', title: 'Gather your people.', detail: 'The host opens a party, chooses a round length and shares a code. Friends, family, a community group. Your kind of people.' },
  { number: '02', title: 'Find your favorite spot.', detail: 'Pull up a chair in the studio. Show up on video or choose an avatar. Both belong here.' },
  { number: '03', title: 'Start something.', detail: 'Choose your canvas shape and orientation. Pick a brush, mix a color, make the first mark. A squiggle is an excellent start.' },
  { number: '04', title: 'Pass it on.', detail: 'At the round cue, finish your thought and pass your canvas around the circle. You get someone else’s beginning. Add something to it.' },
  { number: '05', title: 'See what you made. Together.', detail: 'Keep passing until everyone has contributed, or stop after the host’s chosen number of rounds. Then comes the big reveal.' },
  { number: '06', title: 'Give it a place on the wall.', detail: 'The plan: hang the finished pieces in your studio gallery, replay how they grew and deliberately share the ones you want to share.' },
];
export const workbench = [
  { state: 'Try it now', title: 'A little room to experiment', items: ['A public paint table with brushes, pencil and eraser', 'A look around the Cream City studio', 'An example gallery with creation playback'] },
  { state: 'In the making', title: 'The actual painting party', items: ['Private room codes, seats and video or avatar presence', 'Your own canvas, passed around the circle', 'Host-set rounds and a gentle finishing cue', 'Account sign-in and saved personal workspaces'] },
  { state: 'Next on the table', title: 'Keep the whole story', items: ['Durable art-stroke recording and reconnect recovery', 'Private finished-art galleries and creation replay', 'Intentional sharing, downloads and account albums'] },
  { state: 'Someday pile', title: 'More room for the weird', items: ['More immersive studios and lighting moods', 'A collage crate full of things to stick down', 'Companion tablet panels and custom shortcuts', 'More cats. Probably.'] },
];
