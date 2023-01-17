import {DataTable, setDefaultTimeout} from "@cucumber/cucumber"
import assert from "assert"
import {binding, given, then} from "cucumber-tsflow"
import {bearerAuth, Ketting, Link, Resource, State} from "ketting"
import {Workspace} from "./workspace"


// ten minutes
setDefaultTimeout(600 * 1000);


type ProfileLink = Link & {
  profile?: string
}

type Event = {
  entity: string,
  event:  string,
  key:    string,
  meta:   string,
  data:   string
}


@binding([Workspace])
export class Fetch {

  private noauthKetting: Ketting
  private authKetting: Ketting

  private client: Ketting

  // @ts-ignore
  private resource: Resource
  private appendedEvent: any = null
  private lastEventId: string = ""
  private selectorMark: string = ""
  private selectedEvents: Event[] = []



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
    const allows = this.toList(allowHeader)
      .map((m) => m.toUpperCase())
    const extra = methods.filter((m) => !allows.includes(m))
    const missing = allows.filter((m) => !methods.includes(m))
    assert.ok(!missing.length, `allow header missing methods: ${missing}`)
    assert.ok(!extra.length, `allow header has extra methods: ${extra}`)
  }


  private async parseNdJsonFromState(state: State): Promise<Event[]> {
    const ndJson = await state.data.text()
    return ndJson
      .split("\n")
      .filter((r: string) => r.length)
      .map(JSON.parse)
  }


  private toList(input: string): string[] {
    return input
      .split(",")
      .map((s) => s.trim())
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


  @given(/follows rels '(.+)'/)
  public async followRels(rels: string) {
    const relList = this.toList(rels)
    for (const rel of relList) {
      await this.followRel(rel)
    }
  }


  @then(/follows list entry with name '(.+)'/)
  public async followListEntry(name: string) {
    const entryLinks = await this.resource.links("https://level3.rest/patterns/list#list-entry")
    // @ts-ignore
    const entry = entryLinks.find((l) => l.name === name)
    assert.ok(entry !== undefined, `cannot find link named '${name}' in list: ${JSON.stringify(entryLinks)}`)
    this.resource = await this.client.go(entry)
  }


  @then(/POSTs '(.+)'/)
  public async postData(dataIn: string) {
    return this.postAndFollow(JSON.parse(dataIn))
  }


  private resetResource() {
    return this.authKetting.go("/")
      .follow("ledgers")
      .follow("reset")
  }


  @then(/Authenticated Client resets ledger/)
  public async resetLedger() {
    const reset = await this.resetResource()
    await reset.post({data: {}})
  }


  @then(/resets ledger to remembered event id/)
  public async resetLedgerToRememberedEvent() {
    assert.ok(this.lastEventId, "last event id not remembered")
    const reset = await this.resetResource()
    await reset.post({data: {after: this.lastEventId}})
  }


  private factAppender() {
    return this.authKetting.go("/")
      .follow("append")
      .follow("factual")
  }


  @then(/Authenticated Client appends fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendFactEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.factAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to append fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendFactEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      entity,
      key,
      event,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.factAppender()

    try {
      await appender.post({data: appendEvent})
      assert.fail("should have failed to append fact")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on append")
    }
  }


  @then(/Authenticated Client appends idempotency-key '(.+)', fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendIdempotentFactEvent(iKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    // todo: should be header, according to level3 rest form spec.
    const appendEvent = {
      entity,
      key,
      event,
      "idempotencyKey": iKey,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.factAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client appends facts/)
  public async appendFacts(dataIn: DataTable) {
    const appendRows: Event[] = dataIn.hashes()
    for (const {entity, event, key, meta, data} of appendRows) {
      await this.appendFactEvent(entity, event, key, meta, data)
    }
  }


  private replaySelectorResource() {
    return this.authKetting.go("/")
      .follow("selectors")
      .follow("replay")
  }

  @then(/Authenticated Client replays all events for '(.+)', keys '(.+)'/)
  public async replayAllEvents(entity: string, keysIn: string) {
    const selector = await this.replaySelectorResource()
    const keys = this.toList(keysIn)
    const data = {
      entity,
      keys
    }
    const state = await selector.post({data})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @then(/Authenticated Client replays '(.+)' events for '(.+)', keys '(.+)'/)
  public async replaySpecificEvents(eventsIn: string, entity: string, keysIn: string) {
    const selector = await this.replaySelectorResource()
    const events = this.toList(eventsIn)
    const keys = this.toList(keysIn)
    const data = {
      entity,
      events,
      keys
    }
    const state = await selector.post({data})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @then(/Authenticated Client replays all '(.+)' events, key '(.+)' after remembered selector mark/)
  public async replayAfterRememberedEvent(entity: string, key: string) {
    const selector = await this.replaySelectorResource()
    const data = {
      entity,
      keys: [key],
      after: this.selectorMark
    }
    const state = await selector.post({data})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @then(/Authenticated Client replays (\d+) '(.+)' events from '(.+)', keys '(.+)'/)
  public async replayEventsWithLimit(limit: number, eventsIn: string, entity: string, keysIn: string) {
    const selector = await this.replaySelectorResource()
    const events = this.toList(eventsIn)
    const keys = this.toList(keysIn)
    const data = { entity, keys, events, limit }
    const state = await selector.post({data})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @then(/Authenticated Client replays, after remembered selector mark, (\d+) '(.+)' events from '(.+)', keys '(.+)'/)
  public async replayEventsAfterMarkWithLimit(limit: number, eventsIn: string, entity: string, keysIn: string) {
    const selector = await this.replaySelectorResource()
    const events = this.toList(eventsIn)
    const keys = this.toList(keysIn)
    const data = {
      entity,
      keys,
      events,
      limit,
      after: this.selectorMark
    }
    const state = await selector.post({data})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  private filterSelectorResource() {
    return this.authKetting.go("/")
      .follow("selectors")
      .follow("filter")
  }


  private downloadResource() {
    return this.authKetting.go("/")
      .follow("ledgers")
      .follow("download")
  }


  @given(/Authenticated Client filters '(.+)' events with meta filter '(.+)'/)
  public async filterEventsByMeta(entitiesIn: string, meta: string) {
    const selector = await this.filterSelectorResource()
    const entities = this.toList(entitiesIn)
    const data = entities.reduce((acc, e) => {
      acc[e] = {}
      return acc
    }, {} as Record<string, any>)
    const sendData = { meta, data }
    const state = await selector.post({data: sendData})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client filters, after remembered selector mark, events with meta filter '(.+)'/)
  public async filterEventsAfterByMeta(meta: string) {
    const selector = await this.filterSelectorResource()
    const sendData = {
      meta,
      after: this.selectorMark
    }
    const state = await selector.post({data: sendData})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client filters, after remembered selector mark, (\d+) events with meta filter '(.+)'/)
  public async filterLimitedEventsAfterByMeta(limit: number, meta: string) {
    const selector = await this.filterSelectorResource()
    const sendData = {
      meta,
      limit,
      after: this.selectorMark
    }
    const state = await selector.post({data: sendData})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  private tableToFilters(table: DataTable) {
    return table.hashes()
      .reduce((acc, f) => {
        const entity = acc[f.entity] || {}
        if (Object.keys(entity).length === 0) {
          acc[f.entity] = entity
        }
        entity[f.event] = f.filter
        return acc
      },
      {} as Record<string, any>)
  }


  @given(/Authenticated Client filters all data events/)
  public async filterAllEventsByData(table: DataTable) {
    const selector = await this.filterSelectorResource()
    const filters = this.tableToFilters(table)
    const state = await selector.post({data: {data: filters}})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client filters data events, after remembered event/)
  public async filterEventsByDataAfterMark(table: DataTable) {
    const selector = await this.filterSelectorResource()
    const filters = this.tableToFilters(table)
    const state = await selector.post({data: {
        data: filters,
        after: this.selectorMark
      }
    })
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client filters (\d+) data events, after remembered event/)
  public async filterLimitedEventsByDataAfterMark(limit: number, table: DataTable) {
    const selector = await this.filterSelectorResource()
    const filters = this.tableToFilters(table)
    const state = await selector.post({data: {
        data: filters,
        after: this.selectorMark,
        limit
      }
    })
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client downloads entire ledger/)
  public async downloadAll() {
    const download = await this.downloadResource()
    const state = await download.post({data: {}})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client downloads ledger after last appended event/)
  public async downloadAfter() {
    const download = await this.downloadResource()
    const state = await download.post({data: {after: this.lastEventId}})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client downloads (\d+) events/)
  public async downloadLimit(limit: number) {
    const download = await this.downloadResource()
    const state = await download.post({data: {limit}})
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @given(/Authenticated Client downloads, after last appended event, (\d+) events/)
  public async downloadLimitAfter(limit: number) {
    const download = await this.downloadResource()
    const state = await download.post({data: {
        limit,
        after: this.lastEventId
      }
    })
    this.selectedEvents = await this.parseNdJsonFromState(state)
  }


  @then(/Event count is (\d+)/)
  public async countSelectedEvents(expectedCount: number) {
    // deduct footer row from event count
    const lastRow = this.selectedEvents.at(-1)
    const length = this.selectedEvents.length
    const actualCount = lastRow?.event
      ? length
      : length - 1
    assert.equal(actualCount, expectedCount)
  }


  @then(/last Event is '(.+)'/)
  public async lastEventIs(expectedEvent: string) {
    const lastRow = this.selectedEvents.at(-1)
    const lastEvent = lastRow?.event
      ? lastRow
      : this.selectedEvents.at(-2)
    assert.equal(lastEvent?.event, expectedEvent)
  }


  @then(/remembers last appended event id/)
  public async rememberLastAppendedEventId() {
    this.lastEventId = this.appendedEvent.eventId
  }


  @then(/appended event id matches last appended event id/)
  public async eventIdMatchesSavedAppendedEventId() {
    assert.equal(this.appendedEvent.eventId, this.lastEventId)
  }


  @then(/remembers selector mark/)
  public async rememberSelectorMark() {
    // @ts-ignore  Last 'event' is actually the footer
    this.selectorMark = this.selectedEvents.at(-1)?.mark
  }


  @then(/deletes the resource/)
  public async deleteResource() {
    try {
      await this.resource.delete()
    } catch (err: any) {
      assert.fail(err)
    }
  }


  @then(/fails to delete the resource because of status (\d+)/)
  public async failDeleteResource(expectedStatus: number) {
    try {
      await this.resource.delete()
      assert.fail("should not be able to delete")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on delete")
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
    const expected: ProfileLink[] = data.hashes()
    for (const {rel, href, title, profile} of expected) {
      const actualLink = actual.get(rel) as ProfileLink
      assert.ok(actualLink, `missing link ${rel}`)
      const {href: actualHref, title: actualTitle, profile: actualProfile} = actualLink
      assert.equal(actualHref, href, "Wrong Link HREF")
      if (title) {
        assert.equal(actualTitle, title, "Wrong Link TITLE")
      }
      if (profile) {
        assert.ok(actualProfile, "Missing Link PROFILE")
        assert.equal(actualProfile, profile, "Wrong Link PROFILE")
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
    assert.equal(actualType, expectedType, `wrong type for ${actualValue}`)
  }


  @then(/body has field '(\w+)' with value '([\w\s]+)'/)
  public async bodyHasFieldWithValue(field: string, expectedValue: any) {
    const state = await this.fetch()
    const actualValue = state.data[field]
    assert.ok(actualValue, `body missing '${field}' field: ${JSON.stringify(state.data)}`)
    assert.equal(actualValue, expectedValue, `wrong value for field '${field}'. Expected ${JSON.stringify(expectedValue)}, found ${JSON.stringify(actualValue)}`)
  }


  @then(/Authenticated Client registers event '(.+)' in entity '(.+)'/)
  public async registerEvent(event: string, entity: string) {
    const data = {
      entity,
      event
    }

    const registrar = await this.authKetting.go("/")
      .follow("registry")
      .follow("register")

    const registered = await registrar.postFollow({data})

    const state = await registered.get()

    const {entity: actualEntity, event: actualEvent} = state.data
    assert.equal(actualEntity, entity, "not the same entity")
    assert.equal(actualEvent, event, "not the same event")
  }
}
