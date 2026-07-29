import * as Schema from "effect/Schema"

/**
 * What a member may do inside an organization. better-auth's organization
 * plugin uses the same three names, so a role crosses the boundary unchanged.
 */
export const MemberRole = Schema.Literals(["owner", "admin", "member"])
export type MemberRole = typeof MemberRole.Type

export const SessionUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
})
export type SessionUser = typeof SessionUser.Type

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
})
export type Organization = typeof Organization.Type

export const Member = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  userId: Schema.String,
  role: MemberRole,
  name: Schema.String,
  email: Schema.String,
  image: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
})
export type Member = typeof Member.Type

export const InvitationStatus = Schema.Literals([
  "pending",
  "accepted",
  "rejected",
  "canceled",
])
export type InvitationStatus = typeof InvitationStatus.Type

export const Invitation = Schema.Struct({
  id: Schema.String,
  organizationId: Schema.String,
  email: Schema.String,
  role: MemberRole,
  status: InvitationStatus,
  inviterId: Schema.String,
  expiresAt: Schema.String,
})
export type Invitation = typeof Invitation.Type

/**
 * Who the request is acting as: the signed-in user, the organization they have
 * active, and their role in it. Every workspace read and write is scoped by it.
 */
export const ViewerInfo = Schema.Struct({
  user: SessionUser,
  organization: Organization,
  role: MemberRole,
})
export type ViewerInfo = typeof ViewerInfo.Type

/** The whole picture the SPA boots from: viewer plus the orgs they can pick. */
export const Session = Schema.Struct({
  user: SessionUser,
  organizations: Schema.Array(Organization),
  activeOrganizationId: Schema.NullOr(Schema.String),
  role: Schema.NullOr(MemberRole),
})
export type Session = typeof Session.Type
