// Account records never contain email addresses, OAuth tokens or call media.
export type AvatarMark = 'brush' | 'star' | 'cat' | 'swirl';
export type AvatarColor = 'magenta' | 'teal' | 'violet' | 'gold';
export interface StudioAvatar { mark: AvatarMark; color: AvatarColor }
export interface StudioProfile { id: string; name: string; bio: string; avatar: StudioAvatar; share: boolean; allowRequests: boolean; emailInvites: boolean; emailReminders: boolean }
export interface ScheduledParty { id: string; title: string; startsAt: string; timeZone: string; durationMinutes: number; hostName: string; hosting: boolean; response: 'pending' | 'yes' | 'no'; cancelled: boolean }
export interface PartyHistory { id: string; title: string; endedAt: string; artworkCount: number }
export interface CommunityHome { profile: StudioProfile | null; friends: StudioProfile[]; incoming: StudioProfile[]; outgoing: StudioProfile[]; parties: ScheduledParty[]; history: PartyHistory[]; mail: { partyId: string; kind: 'invitation' | 'reminder'; state: string }[] }
export interface SharedParty { title: string; startsAt: string; timeZone: string; durationMinutes: number; hostName: string }
export interface ScheduleInput { title: string; startsAt: string; timeZone: string; durationMinutes: number }
