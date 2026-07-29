import * as Context from "effect/Context"
import type { MemberRole, Organization, SessionUser } from "../schema/identity.schema.ts"

/**
 * Who a request is acting as. Provided once per request from the verified
 * session, and read by the repositories that scope every query to one
 * organization — so no feature can forget the tenant boundary and still
 * compile. Services take it at construction, keeping their own effects
 * dependency-free.
 */
export interface ViewerShape {
  readonly user: SessionUser
  readonly organization: Organization
  readonly role: MemberRole
}

export class Viewer extends Context.Service<Viewer, ViewerShape>()("Viewer") {}
