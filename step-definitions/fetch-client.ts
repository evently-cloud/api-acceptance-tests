import {DataTable} from "@cucumber/cucumber"
import assert from "assert"
import {binding, given, then} from "cucumber-tsflow"
import {bearerAuth, Ketting, Link, Resource} from "ketting"
import {Workspace} from "./workspace"



@binding([Workspace])
export class Fetch {

  private noauthKetting: Ketting
  private authKetting: Ketting

  private client: Ketting

  // @ts-ignore
  private resource: Resource


  public constructor(protected workspace: Workspace) {
    this.noauthKetting = new Ketting(workspace.eventlyUrl)
    this.authKetting = new Ketting(workspace.eventlyUrl)
    this.authKetting.use(bearerAuth(workspace.eventlyToken))
    this.client = this.noauthKetting
  }


  fetch() {
    return this.resource.get()
  }


  async postAndFollow(data: any) {
    this.resource = await this.resource.postFollow({data})
  }


  private assertOnlyAllows(headers: Headers, methods: string[]) {
    const allowHeader = headers.get("allow") || ""
    const allows = allowHeader.split(",").map((m) => m.trim().toUpperCase())
    const extra = methods.filter((m) => !allows.includes(m))
    const missing = allows.filter((m) => !methods.includes(m))
    assert.ok(!missing.length, `allow header missing methods: ${missing}`)
    assert.ok(!extra.length, `allow header has extra methods: ${extra}`)
  }


  @given("Client starts at root")
  public async getRoot() {
    this.client = this.noauthKetting
    this.resource = await this.client.go("/")
  }


  @given("Authenticated Client starts at root")
  public async getRootAsAuthenticatedClient() {
    this.client = this.authKetting
    this.resource = await this.client.go("/")
  }


  @given(/follows rel '(.+)'/)
  public async followRel(rel: string) {
    this.resource = await this.resource.follow(rel)
  }


  @then(/follows list entry with name '(.+)'/)
  public async followListEntry(name: string) {
    const entryLinks = await this.resource.links("https://level3.rest/patterns/list#list-entry")
    // @ts-ignore
    const entry = entryLinks.find((l) => l.name === name)
    assert.ok(entry !== undefined, `cannot find link named '${name}' in list: ${JSON.stringify(entryLinks)}`)
    this.resource = await this.client.go(entry)
  }


  @then(/deletes the resource/)
  public async deleteResource() {
    try {
      await this.resource.delete()
    } catch (err: any) {
      assert.fail(err)
    }
  }


  @then("content is HAL")
  public async isHal() {
    const state = await this.fetch()
    const {headers} = state
    const contentType = headers.get("content-type")
    assert.ok(contentType?.includes("application/hal+json"), `Content-Type not HAL: ${contentType}`)
  }


  @then("content is JSON Schema")
  public async isJsonSchema() {
    const state = await this.fetch()
    const {headers} = state
    const contentType = headers.get("content-type")
    assert.ok(contentType?.includes("application/schema+json"), `Content-Type not JSON Schema: ${contentType}`)
  }


  @then(/has L3 Home profile/)
  public async hasHomeProfile() {
    await this.hasProfile("https://level3.rest/profiles/home", ["GET", "HEAD"])
  }


  @then(/has L3 Form profile/)
  public async hasFormProfile() {
    await this.hasProfile("https://level3.rest/profiles/form", ["GET", "HEAD", "POST"])
  }


  @then(/has L3 Lookup profile/)
  public async hasLookupProfile() {
    await this.hasProfile("https://level3.rest/profiles/lookup", ["GET", "HEAD", "POST"])
  }


  @then(/has L3 Data profile/)
  public async hasDataProfile() {
    await this.hasProfile("https://level3.rest/profiles/data", ["GET", "HEAD", "DELETE"])
  }


  @then(/has L3 Representation profile/)
  public async hasRepresentationProfile() {
    await this.hasProfile("https://level3.rest/profiles/mixins/representation")
  }


  @then(/has L3 Add Entry Resource profile/)
  public async hasAddEntryResourceProfile() {
    await this.hasProfile("https://level3.rest/patterns/list#add-entry-resource")
  }


  @then(/has L3 List Resource profile/)
  public async hasListResourceProfile() {
    await this.hasProfile("https://level3.rest/patterns/list#list-resource")
  }


  @then(/has L3 Entry Resource profile/)
  public async hasEntryResourceProfile() {
    await this.hasProfile("https://level3.rest/patterns/list#entry-resource")
  }


  async hasProfile(profile: string, allows?: string[]) {
    const state = await this.fetch()
    const {headers} = state
    const profiles = headers.get("profile")
    assert.ok(profiles?.includes(profile), `missing ${profile} profile header.`)
    if (allows) {
      this.assertOnlyAllows(headers, allows)
    }
  }


  @then(/has links/)
  public async hasLinks(data: DataTable) {
    const state = await this.fetch()
    const {links: actual} = state
    const expected: Link[] = data.hashes()
    for (const {rel, href, title} of expected) {
      const actualLink = actual.get(rel)
      assert.ok(actualLink, `missing link ${rel}`)
      const {href: actualHref, title: actualTitle} = actualLink
      assert.equal(href, actualHref, "Wrong link HREF")
      if (title) {
        assert.equal(title, actualTitle, "wrong link TITLE")
      }
    }
  }


  @then(/Client is not authorized/)
  public async notAuthorized() {
    try {
      await this.fetch()
      assert.fail("Client should not be authorized to access this resource.")
    } catch (err: any) {
      assert.equal(err.status, 401, "wrong status code")
    }
  }


  @then(/body has (string|number|boolean) field '(\w+)'/)
  public async bodyHasField(expectedType: string, field: string) {
    const state = await this.fetch()
    const actualValue = state.data[field]
    assert.notEqual(actualValue, undefined, `body missing '${field}' field: ${JSON.stringify(state.data)}`)
    const actualType = typeof actualValue
    assert.equal(expectedType, actualType, `wrong type for ${actualValue}`)
  }


  @then(/body has field '(\w+)' with value '([\w\s]+)'/)
  public async bodyHasFieldWithValue(field: string, expectedValue: any) {
    const state = await this.fetch()
    const actualValue = state.data[field]
    assert.notEqual(actualValue, undefined, `body missing '${field}' field: ${JSON.stringify(state.data)}`)
    assert.equal(expectedValue, actualValue, `wrong value for field '${field}'`)
  }


  @then(/registers event '(.+)' in entity '(.+)'/)
  public async registerEvent(event: string, entity: string) {
    const form = {
      entity,
      event
    }
    await this.postAndFollow(form)
    const state = await this.fetch()
    const {entity: actualEntity, event: actualEvent} = state.data
    assert.equal(entity, actualEntity, "not the same entity")
    assert.equal(event, actualEvent, "not the same event")
  }
}
