import {DataTable, setDefaultTimeout} from "@cucumber/cucumber"
import assert from "assert"
import {binding, given, then} from "cucumber-tsflow"
import EventSource from "eventsource"
import {bearerAuth, Ketting, Link, Resource, State} from "ketting"
import {scheduler} from "timers/promises"
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

type Selector = {
  selectorId: string,
  mark:       string
}

function isEvent(input: any): input is Event {
  return input.event
}


@binding([Workspace])
export class Fetch {

  private accessToken = ""
  private noauthKetting: Ketting
  private authKetting: Ketting

  private client: Ketting

  // @ts-ignore
  private resource: Resource
  private appendedEvent: any = null
  private lastEventId: string = ""
  private lastSelector: Selector | undefined
  private selectedEvents: Array<Selector | Event> = []
  private channel: Resource | undefined
  private subscribedSelector: Selector | undefined
  private sseMark: string | undefined
  private sseSelectorsTriggered: string[] = []
  private eventSource: EventSource | undefined



  public constructor(protected workspace: Workspace) {
    this.noauthKetting = new Ketting(workspace.eventlyUrl)
    this.authKetting = new Ketting(workspace.eventlyUrl)
    this.authKetting.use(bearerAuth(workspace.eventlyToken))
    this.client = this.noauthKetting
    this.accessToken = workspace.eventlyToken
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
  public async appendIdempotentFactEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      idempotencyKey,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.factAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to append idempotency-key '(.+)', fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendIdempotentFactEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      entity,
      key,
      event,
      idempotencyKey,
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


  @then(/Authenticated Client appends facts/)
  public async appendFacts(dataIn: DataTable) {
    const appendRows = dataIn.hashes()
    for (const {entity, event, key, meta, data} of appendRows) {
      await this.appendFactEvent(entity, event, key, meta, data)
    }
  }


  private serialAppender() {
    return this.authKetting.go("/")
      .follow("append")
      .follow("serial")
  }


  @then(/Authenticated Client serially appends event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendSerialEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      meta:             JSON.parse(metaIn),
      data:             JSON.parse(dataIn),
      previousEventId:  this.lastEventId
    }
    const appender = await this.serialAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client serially appends idempotency-key '(.+)', event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendSerialIdempotentEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      idempotencyKey,
      meta:            JSON.parse(metaIn),
      data:            JSON.parse(dataIn),
      previousEventId: this.lastEventId
    }
    const appender = await this.serialAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to serially append event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendSerialEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      entity,
      key,
      event,
      meta:             JSON.parse(metaIn),
      data:             JSON.parse(dataIn),
      previousEventId:  this.lastEventId
    }
    const appender = await this.serialAppender()

    try {
      await appender.post({data: appendEvent})
      assert.fail("should have failed to append serial event")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on append")
    }
  }


  private atomicAppender() {
    return this.authKetting.go("/")
      .follow("append")
      .follow("atomic")
  }


  @then(/Authenticated Client atomically appends event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendAtomicEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector: this.lastSelector
    }
    const appender = await this.atomicAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client atomically appends idempotency-key '(.+)', event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendAtomicIdempotentEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      entity,
      key,
      event,
      idempotencyKey,
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector:       this.lastSelector
    }
    const appender = await this.atomicAppender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to atomically append event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendAtomicEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      entity,
      key,
      event,
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector: this.lastSelector
    }
    const appender = await this.atomicAppender()

    try {
      await appender.post({data: appendEvent})
      assert.fail("should have failed to append atomic event")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on append")
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
      after: this.lastSelector?.mark
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
      after: this.lastSelector?.mark
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
      after: this.lastSelector?.mark
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
      after: this.lastSelector?.mark
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
        after: this.lastSelector?.mark
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
        after: this.lastSelector?.mark,
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
    const actualCount = isEvent(lastRow)
      ? length
      : length - 1
    assert.equal(actualCount, expectedCount)
  }


  @then(/last Event is '(.+)'/)
  public async lastEventIs(expectedEvent: string) {
    const lastRow = this.selectedEvents.at(-1)
    const lastEvent = isEvent(lastRow)
      ? lastRow
      : this.selectedEvents.at(-2) as Event
    assert.equal(lastEvent.event, expectedEvent)
  }



  @then(/subscribes to selector/)
  public async subscribeToSelector() {
    if (this.lastSelector) {
      this.subscribedSelector = this.lastSelector
    }
    const subscribe = await this.channel?.follow("subscribe")
    const subscription = await subscribe?.postFollow({
      data: {
      selectorId: this.lastSelector?.selectorId
      }
    })
    if (subscription) {
      this.resource = subscription
      let result = await subscription.fetch()
      const {selector, selectorType} = await result.json()
      if (selector.keys) {
        assert.equal(selectorType, "Replay selector")
      } else {
        assert.equal(selectorType, "Filter selector")
      }
      // check subscriptions resource
      const subs = await this.channel?.follow("subscriptions")
      if (subs) {
        result = await subs.fetchOrThrow()
        const {_links} = await result.json()
        const {title, profile, href} = _links["https://level3.rest/patterns/list/editable#add-entry"]
        // title, form profile, subscribe.uri endswith href
        assert.equal(title, "Selector subscription form")
        assert.equal(profile, "https://level3.rest/profiles/form")
        assert.ok(subscribe?.uri.endsWith(href))
        const entries: Link[] = _links["https://level3.rest/patterns/list#list-entry"]
        // missing profile attribute on Link
        const foundSub: any = entries.find((entry) => subscription.uri.endsWith(entry.href))
        assert.ok(foundSub)
        assert.equal(foundSub.profile, "https://level3.rest/profiles/data")
      }
    }
  }


  @then(/remembers last appended event id/)
  public async rememberLastAppendedEventId() {
    this.lastEventId = this.appendedEvent.eventId
  }


  @then(/appended event id matches last appended event id/)
  public async eventIdMatchesSavedAppendedEventId() {
    assert.equal(this.appendedEvent.eventId, this.lastEventId)
  }


  @then(/remembers selector/)
  public async rememberSelector() {
    // @ts-ignore  Last 'event' is actually the footer
    this.lastSelector = this.selectedEvents.at(-1)
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


  @then(/has L3 Nexus profile/)
  public async hasNexusProfile() {
    await this.hasProfile("https://level3.rest/profiles/nexus", ["GET", "HEAD", "DELETE"])
  }


  @then(/has L3 Form profile/)
  public async hasFormProfile() {
    await this.hasProfile("https://level3.rest/profiles/form", ["GET", "HEAD", "POST"])
  }


  @then(/has L3 Lookup profile/)
  public async hasLookupProfile() {
    await this.hasProfile("https://level3.rest/profiles/lookup", ["GET", "HEAD", "POST"])
  }


  @then(/has L3 Action profile/)
  public async hasActionProfile() {
    await this.hasProfile("https://level3.rest/profiles/action", ["GET", "HEAD", "POST"])
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
    const expected = data.hashes()
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


  @then(/has notify links/)
  public async hasNotifyLinks(data: DataTable) {
    const channelUri = this.channel?.uri
    if (channelUri) {
      const lastSlash = channelUri.lastIndexOf("/")
      const channelId = channelUri.substring(lastSlash)
      const newRows = data.raw().map(
        (row) => row.map((cell) => cell.replace("/CID", channelId)))
      const newData = new DataTable(newRows)
      await this.hasLinks(newData)
    } else {
      assert.fail("cannot get channel state")
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


  @then(/Client fails to open a notification channel/)
  public async openChannelAndFail() {
    const channelOpener = await this.client.go("/")
      .follow("notifications")
      .follow("open-channel")

    const result = await channelOpener.fetch({
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: "{}"
    })
    assert.equal(401, result.status)
  }


  @then(/Authenticated Client opens a notification channel/)
  public async openChannel() {
    const channelOpener = await this.authKetting.go("/")
      .follow("notifications")
      .follow("open-channel")

    this.channel = await channelOpener.postFollow({data:{}})
    this.resource = this.channel
    const stream= await this.channel.follow("stream")
    this.eventSource = new EventSource(stream?.uri || "FAIL", {
      headers: {Authorization: `Bearer ${this.accessToken}`}
    })
    this.eventSource.addEventListener("Selectors Triggered", (me) => {
      this.sseMark = me.lastEventId
      this.sseSelectorsTriggered = me.data.split(",")
    })
  }


  @then(/closes channel/)
  public async closeChannel() {
    this.eventSource?.close()
  }


  @then(/notification matches id and selector/)
  public async notificationMatchesIdAndSelector() {
    // wait for notification to arrive
    await scheduler.wait(100)
    const expectedSseMark = `${this.lastEventId.substring(0, 16)}${this.lastEventId.slice(-8)}`
    assert.equal(expectedSseMark, this.sseMark)
    assert.ok(this.sseSelectorsTriggered.includes(this.subscribedSelector?.selectorId || ""))
  }
}
