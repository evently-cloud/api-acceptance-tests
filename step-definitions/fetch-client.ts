import { DataTable, setDefaultTimeout } from "@cucumber/cucumber"
import assert from "assert"
import tsflow from "cucumber-tsflow"
//ts-flow is CommonJS
const { binding, given, then } = tsflow
import { EventSource } from "eventsource"
import { bearerAuth, Ketting, Link, NeverCache, Resource, State } from "ketting"
import { scheduler } from "timers/promises"

import { Workspace } from "./workspace.js"


// ten minutes. This allows for long debugging sessions
setDefaultTimeout(600 * 1000);

const LEDGER_NAME = "API acceptance test ledger"


type ProfileLink = Link & {
  profile?: string
}

type JsonpathQuery = {
  query: string
  vars?: Record<string, any>
}

type Event = {
  event:    string
  entities: Record<string, string[]>
  meta:     string
  data:     string
}

type SelectorQuery = {
  entities?:  Record<string, string[]>
  meta?:      JsonpathQuery
  events?:    Record<string, JsonpathQuery>
  after?:      string
}

function isEvent(input: any): input is Event {
  return input.event
}


type AuthInfo = {
  ledger?: string,
  roles: string[]
}


function generateAuthToken(auth: AuthInfo) {
  return Buffer.from(JSON.stringify(auth)).toString("base64url")
}

function setAuthorization(ketting: Ketting, auth: AuthInfo) {
  const authToken = generateAuthToken(auth)
  ketting.use(bearerAuth(authToken))
}


// constructed during every scenario
@binding([Workspace])
export class Fetch {

  private ledgerId: string | undefined
  private clientToken: string = "NO CLIENT TOKEN SET"
  private client: Ketting | undefined

  // @ts-ignore // it will be set
  private resource: Resource
  private response: Response | undefined
  private appendedEvent: any = null
  private lastEventId: string = ""
  private lastMark: string | undefined
  private lastSelectorQuery: SelectorQuery | undefined
  private currentState: State | undefined
  private rememberedLink: Link | undefined
  private selectedEvents: Array<string | Event> = []
  private channel: Resource | undefined
  private subscriptionId: string | undefined
  private sseMark: string | undefined
  private sseSubscriptionsTriggered: string[] = []
  private eventSource: EventSource | undefined


  // This is constructed at the start of every scenario.
  public constructor(protected workspace: Workspace) {
    workspace.adminKetting = new Ketting(workspace.eventlyUrl)
    workspace.adminKetting.cache = new NeverCache()
    setAuthorization(workspace.adminKetting, {roles: ["admin"]})
  }


  fetch() {
    return this.resource.get()
  }


  async postSelector(query: SelectorQuery): Promise<void> {
    const selector = await this.workspace.getClient().go("/")
      .follow("selectors")

    const state = await selector.post({data: query})
    await this.processSelectorDownloadResult(state)

    this.lastSelectorQuery = query
  }


  async postAndFollow(data: any) {
    this.resource = await this.resource.postFollow({data})
  }


  private assertOnlyAllows(headers: Headers, methods: string[]) {
    const allowHeader = headers.get("allow") ?? ""
    const allows = this.toList(allowHeader)
      .map((m) => m.toUpperCase())
    const extra = methods.filter((m) => !allows.includes(m))
    const missing = allows.filter((m) => !methods.includes(m))
    assert.ok(!missing.length, `allow header missing methods: ${missing}`)
    assert.ok(!extra.length, `allow header has extra methods: ${extra}`)
  }


  private async processSelectorDownloadResult(state: State) {
    this.currentState = state
    const ndJson = await state.data.text()
    this.selectedEvents = ndJson
      .split("\n")
      .filter((r: string) => r.length)
      .map(JSON.parse)
  }


  private toList(input: string): string[] {
    return input
      .split(",")
      .map((s) => s.trim())
  }

  private toEventQueries(input: string): Record<string, JsonpathQuery> {
    return this.toList(input)
      .reduce((acc, e) => ({
        ...acc,
        [e]: { query: "$" }
      }), {})
  }


  @given("Ledger has been created")
  public async createLedger() {
    if (!this.ledgerId) {
      const createResource = await this.workspace.getAdmin().go("/")
        .follow("ledgers")
        .follow("https://level3.rest/patterns/list/editable#add-entry")

      const newLedger = await createResource.postFollow({
        data: {
          name: LEDGER_NAME,
          description: "Ledger used for REST API testing"
        }
      })
      const state = await newLedger.get()
      this.ledgerId = state.data.id
      this.workspace.registrarKetting = new Ketting(this.workspace.eventlyUrl)
      this.workspace.registrarKetting.cache = new NeverCache()
      setAuthorization(this.workspace.getRegistrar(), {ledger: this.ledgerId, roles: ["registrar"]})
      this.workspace.publicKetting = new Ketting(this.workspace.eventlyUrl)
      this.workspace.publicKetting.cache = new NeverCache()
      setAuthorization(this.workspace.getPublic(), {ledger: this.ledgerId, roles: ["public"]})
      this.workspace.clientKetting = new Ketting(this.workspace.eventlyUrl)
      this.workspace.clientKetting.cache = new NeverCache()
      const clientAuthDetails = {ledger: this.ledgerId, roles: ["client"]}
      setAuthorization(this.workspace.getClient(),clientAuthDetails)
      this.client = this.workspace.getPublic()
      // needed by NOTIFY tests, which don't use Ketting
      this.clientToken = generateAuthToken(clientAuthDetails)
    }
  }


  @given("deletes the ledger")
  public async deleteLedger() {
    if (this.ledgerId) {
      await this.deleteResource()
      this.ledgerId = undefined
    } else {
      throw new Error("no ledger to delete")
    }
  }


  @given("Public Client starts at root")
  public getRootAsPublicClient() {
    this.client = this.workspace.getPublic()
    this.resource = this.client.go("/")
  }


  @given("Authenticated Client starts at root")
  public getRootAsAuthenticatedClient() {
    this.client = this.workspace.getClient()
    this.resource = this.client.go("/")
  }


  @given("Registrar Client starts at root")
  public getRootAsRegistrarClient() {
    this.client = this.workspace.getRegistrar()
    this.resource = this.client.go("/")
  }


  @given("Admin Client starts at root")
  public getRootAsAdminClient() {
    this.client = this.workspace.getAdmin()
    this.resource = this.client.go("/")
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


  @given("follows link to current ledger")
  public async followCurrentLedger() {
    await this.goToLedger(LEDGER_NAME)
  }


  @then(/follows list entry with name '(.+)'/)
  public async followListEntry(name: string) {
    const state = await this.fetch();
    const entryLinks = state.links.getMany("https://level3.rest/patterns/list#list-entry")
    const entry = entryLinks.find((l) => l.name === name)
    assert.ok(entry !== undefined, `cannot find link named '${name}' in list: ${JSON.stringify(entryLinks)}`)
    assert.ok(this.client !== undefined, "client not set!")
    this.resource = this.client.go(entry)
  }


  @then(/POSTs '(.+)'/)
  public async postData(dataIn: string) {
    return this.postAndFollow(JSON.parse(dataIn))
  }

  private async goToLedger(ledgerName: string) {
    this.client = this.workspace.getAdmin()
    this.resource = await this.client.go("/")
      .follow("ledgers")
    await this.followListEntry(ledgerName)
  }

  private async resetResource() {
    await this.goToLedger(LEDGER_NAME)
    await this.followRel("reset")
  }


  @then("Admin Client resets ledger")
  public async resetLedger() {
    await this.resetResource()
    await this.resource.post({data: {}})
  }


  @then("resets ledger to remembered event id")
  public async resetLedgerToRememberedEvent() {
    assert.ok(this.lastEventId, "last event id not remembered")
    await this.resetResource()
    await this.resource.post({data: {after: this.lastEventId}})
  }


  private appender() {
    return this.workspace.getClient().go("/")
      .follow("append")
  }


  @then(/Authenticated Client appends fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendFactEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.appender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to append fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendFactEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.appender()

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
      event,
      entities: {
        [entity]: [key]
      },
      idempotencyKey,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.appender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to append idempotency-key '(.+)', fact '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendIdempotentFactEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      idempotencyKey,
      meta: JSON.parse(metaIn),
      data: JSON.parse(dataIn)
    }
    const appender = await this.appender()
    try {
      await appender.post({data: appendEvent})
      assert.fail("should have failed to append fact")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on append")
    }
  }


  @then("Authenticated Client appends facts")
  public async appendFacts(dataIn: DataTable) {
    const appendRows = dataIn.hashes()
    for (const {entity, event, key, meta, data} of appendRows) {
      await this.appendFactEvent(entity, event, key, meta, data)
    }
  }


  @then(/Authenticated Client atomically appends event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendAtomicEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector: this.lastSelectorQuery
    }
    const appender = await this.appender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client atomically appends idempotency-key '(.+)', event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)'/)
  public async appendAtomicIdempotentEvent(idempotencyKey: string, entity: string, event: string, key: string, metaIn: string, dataIn: string) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      idempotencyKey,
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector: this.lastSelectorQuery
    }
    const appender = await this.appender()
    const appendResult = await appender.post({data: appendEvent})
    this.appendedEvent = appendResult.data
  }


  @then(/Authenticated Client fails to atomically append event '(.+)\/(.+)', key '(.+)', meta '(.+)' and data '(.+)' because '(\d+)'/)
  public async failAppendAtomicEvent(entity: string, event: string, key: string, metaIn: string, dataIn: string, expectedStatus: number) {
    const appendEvent = {
      event,
      entities: {
        [entity]: [key]
      },
      meta:     JSON.parse(metaIn),
      data:     JSON.parse(dataIn),
      selector: this.lastSelectorQuery
    }
    const appender = await this.appender()

    try {
      await appender.post({data: appendEvent})
      assert.fail("should have failed to append atomic event")
    } catch (err: any) {
      assert.equal(err.response.status, expectedStatus, "wrong failure on append")
    }
  }


  @then(/Authenticated Client replays all events for '(.+)', keys '(.+)'/)
  public async replayAllEvents(entity: string, keysIn: string) {
    const keys = this.toList(keysIn)
    const query = {
      entities: {
        [entity]: keys
      }
    }
    await this.postSelector(query)
  }


  @then(/Authenticated Client replays '(.+)' events for '(.+)', keys '(.+)'/)
  public async replaySpecificEvents(eventsIn: string, entity: string, keysIn: string) {
    const events = this.toEventQueries(eventsIn)
    const keys = this.toList(keysIn)
    const query = {
      entities: {
        [entity]: keys
      },
      events
    }
    await this.postSelector(query)
  }


  @then(/Authenticated Client replays all '(.+)' events, key '(.+)' after remembered selector mark/)
  public async replayAfterRememberedEvent(entity: string, key: string) {
    const query = {
      entities: {
        [entity]: [key]
      },
      after: this.lastMark
    }
    await this.postSelector(query)
  }


  @then(/Authenticated Client replays (\d+) '(.+)' events from '(.+)', keys '(.+)'/)
  public async replayEventsWithLimit(limit: number, eventsIn: string, entity: string, keysIn: string) {
    const events = this.toEventQueries(eventsIn)
    const keys = this.toList(keysIn)
    const query = {
      entities: {
        [entity]: keys
      },
      events,
      limit
    }
    await this.postSelector(query)
  }


  @then(/Authenticated Client replays, after remembered selector mark, (\d+) '(.+)' events from '(.+)', keys '(.+)'/)
  public async replayEventsAfterMarkWithLimit(limit: number, eventsIn: string, entity: string, keysIn: string) {
    const events = this.toEventQueries(eventsIn)
    const keys = this.toList(keysIn)
    const query = {
      entities: {
        [entity]: keys
      },
      events,
      limit,
      after: this.lastMark
    }
    await this.postSelector(query)
  }


  private async downloadResource() {
    await this.goToLedger(LEDGER_NAME)
    await this.followRel("download")
  }

  @given(/Authenticated Client filters all events with meta filter '(.+)'/)
  public async filterEventsByMeta(metaFilter: string) {
    const meta = { query: metaFilter }
    const query = { meta }
    await this.postSelector(query)
 }


  @given(/Authenticated Client filters, after remembered selector mark, events with meta filter '(.+)'/)
  public async filterEventsAfterByMeta(metaFilter: string) {
    const meta = { query: metaFilter }
    const query = {
      meta,
      after: this.lastMark
    }
    await this.postSelector(query)
  }


  @given(/Authenticated Client filters, after remembered selector mark, (\d+) events with meta filter '(.+)'/)
  public async filterLimitedEventsAfterByMeta(limit: number, metaFilter: string) {
    const meta = { query: metaFilter }
    const query = {
      meta,
      limit,
      after: this.lastMark
    }
    await this.postSelector(query)
  }


  /*
  Producing:
  {
  "Store": {
    "Item Stocked": "$.sku ? (@ == \"Limes\")"
  }
  Should be just
  {
    "Item Stocked": "$.sku ? (@ == \"Limes\")"
  }
}
   */
  private tableToFilters(table: DataTable) {
    return table.hashes()
      .reduce((acc, f) => ({
        ...acc,
        [f.event]: { query: f.filter }
      }),
      {} as Record<string, JsonpathQuery>)
  }


  @given("Authenticated Client filters all data events")
  public async filterAllEventsByData(table: DataTable) {
    const filters = this.tableToFilters(table)
    const query = { events: filters }
    await this.postSelector(query)
  }


  @given("Authenticated Client filters data events, after remembered event")
  public async filterEventsByDataAfterMark(table: DataTable) {
    const filters = this.tableToFilters(table)
    const query = {
      events: filters,
      after: this.lastMark
    }
    await this.postSelector(query)
  }


  @given(/Authenticated Client filters (\d+) data events, after remembered event/)
  public async filterLimitedEventsByDataAfterMark(limit: number, table: DataTable) {
    const filters = this.tableToFilters(table)
    const query = {
      events: filters,
      after: this.lastMark,
      limit
    }
    await this.postSelector(query)
  }


  @given("Admin Client downloads entire ledger")
  public async downloadAll() {
    await this.downloadResource()
    const state = await this.resource.post({data: {}})
    await this.processSelectorDownloadResult(state)
  }


  @given("Admin Client downloads ledger after last appended event")
  public async downloadAfter() {
    await this.downloadResource()
    const state = await this.resource.post({data: {after: this.lastEventId}})
    await this.processSelectorDownloadResult(state)
  }


  @given(/Admin Client downloads (\d+) events/)
  public async downloadLimit(limit: number) {
    await this.downloadResource()
    const state = await this.resource.post({data: {limit}})
    await this.processSelectorDownloadResult(state)
  }


  @given(/Admin Client downloads, after last appended event, (\d+) events/)
  public async downloadLimitAfter(limit: number) {
    await this.downloadResource()
    const state = await this.resource.post({data: {
        limit,
        after: this.lastEventId
      }
    })
    await this.processSelectorDownloadResult(state)
  }


  @given("Admin client gets remembered link")
  public async getRememberedLink() {
    this.resource = this.workspace.getAdmin().go(this.rememberedLink?.href)
    const state = await this.fetch()
    await this.processSelectorDownloadResult(state)
  }

  @then(/Event count is (\d+)/)
  public async countSelectedEvents(expectedCount: number) {
    const lastRow = this.selectedEvents.at(-1)
    const length = this.selectedEvents.length
    // deduct footer row from event count, if present. Might be a footer, which is not an event
    const actualCount = lastRow && !isEvent(lastRow)
      ? length - 1
      : length
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



  @then("Authenticated Client subscribes to selector")
  public async subscribeToSelector() {
    const subscribe = await this.channel?.follow("subscribe")
    const subscription = await subscribe?.postFollow({ data: this.lastSelectorQuery })
    if (subscription) {
      this.resource = subscription
      let result = await subscription.fetch()
      const body = await result.json()
      const {id, selectorType} = body
      this.subscriptionId = id
      assert.equal(selectorType, "Event Filter")
      // check subscriptions resource
      const subs = await this.channel?.follow("subscriptions")
      if (subs) {
        result = await subs.fetchOrThrow()
        const {_links} = await result.json()
        const {title, profile, href} = _links["https://level3.rest/patterns/list/editable#add-entry"]
        // title, form profile, subscribe.uri ends with href
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


  @then("remembers last appended event id")
  public async rememberLastAppendedEventId() {
    this.lastEventId = this.appendedEvent.eventId
  }


  @then(/remembers '(.+)' link/)
  public async rememberLink(linkName: string) {
    this.rememberedLink = this.currentState?.links.get(linkName)
  }


  @then("appended event id matches last appended event id")
  public async eventIdMatchesSavedAppendedEventId() {
    assert.equal(this.appendedEvent.eventId, this.lastEventId)
  }


  @then("remembers selector mark")
  public async rememberSelector() {
    // @ts-ignore – Last 'event' is actually the footer
    this.lastMark = this.selectedEvents.at(-1).mark
    if (this.lastSelectorQuery) {
      this.lastSelectorQuery.after = this.lastMark
    } else {
      assert ("cannot remember, last selector query is undefined.")
    }
  }


  @then("deletes the resource")
  public async deleteResource() {
    try {
      this.response = await this.resource.fetchOrThrow({method: "DELETE"})
    } catch (err: any) {
      assert.fail(err)
    }
  }


  @then(/result has status code (\d+)/)
  public async resultHasStatusCode(expectedStatusCode: number) {
    assert.equal(this.response?.status, expectedStatusCode)
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


  @then("has L3 Home profile")
  public async hasHomeProfile() {
    await this.hasProfile("https://level3.rest/profiles/home", ["GET", "HEAD"])
  }


  @then("has L3 Info profile")
  public async hasInfoProfile() {
    await this.hasProfile("https://level3.rest/profiles/info", ["GET", "HEAD"])
  }


  @then("has L3 Nexus profile")
  public async hasNexusProfile() {
    await this.hasProfile("https://level3.rest/profiles/nexus", ["GET", "HEAD", "DELETE"])
  }


  @then("has L3 Form profile")
  public async hasFormProfile() {
    await this.hasProfile("https://level3.rest/profiles/form", ["GET", "HEAD", "POST"])
  }


  @then("has L3 Lookup profile")
  public async hasLookupProfile() {
    await this.hasProfile("https://level3.rest/profiles/lookup", ["GET", "HEAD", "POST"])
  }


  @then("has L3 Action profile")
  public async hasActionProfile() {
    await this.hasProfile("https://level3.rest/profiles/action", ["GET", "HEAD", "POST"])
  }


  @then("has L3 Data profile")
  public async hasDataProfile() {
    await this.hasProfile("https://level3.rest/profiles/data", ["GET", "HEAD", "DELETE"])
  }


  @then("has L3 Representation profile")
  public async hasRepresentationProfile() {
    await this.hasProfile("https://level3.rest/profiles/mixins/representation")
  }


  @then("has L3 Add Entry Resource profile")
  public async hasAddEntryResourceProfile() {
    await this.hasProfile("https://level3.rest/patterns/list#add-entry-resource")
  }


  @then("has L3 List Resource profile")
  public async hasListResourceProfile() {
    await this.hasProfile("https://level3.rest/patterns/list#list-resource")
  }


  @then("has L3 Entry Resource profile")
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


  @then("has links")
  public async hasLinks(data: DataTable) {
    const state = await this.fetch()
    const {links: actual} = state
    const expected = data.hashes()
    for (const {rel, href, title, profile} of expected) {
      const actualLink = actual.get(rel) as ProfileLink
      assert.ok(actualLink, `missing link ${rel}`)
      const {href: actualHref, title: actualTitle, profile: actualProfile} = actualLink
      if (href) {
        assert.equal(actualHref, href, "Wrong Link HREF")
      }
      if (title) {
        assert.equal(actualTitle, title, "Wrong Link TITLE")
      }
      if (profile) {
        assert.ok(actualProfile, "Missing Link PROFILE")
        assert.equal(actualProfile, profile, "Wrong Link PROFILE")
      }
    }
  }


  @then("has notify links")
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


  @then("Client is not authorized")
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


  @then(/Registrar Client registers event '(.+)' in entity '(.+)'/)
  public async registerEvent(event: string, entity: string) {
    const entities = [entity]
    const data = {
      event,
      entities
    }

    const registrar = await this.workspace.getRegistrar().go("/")
      .follow("registry")
      .follow("register")

    const registered = await registrar.postFollow({data})

    const state = await registered.get()

    const {event: actualEvent, entities: actualEntities} = state.data
    assert.equal(actualEvent, event, "not the same event")
    assert.deepStrictEqual(actualEntities, entities, "not the same entity")
  }


  @then("Client fails to open a notification channel")
  public async openChannelAndFail() {
    assert.ok(this.client !== undefined, "client not set!")
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


  @then("Authenticated Client opens a notification channel")
  public async openChannel() {
    const channelOpener = await this.workspace.getClient().go("/")
      .follow("notifications")
      .follow("open-channel")

    this.channel = await channelOpener.postFollow({data: {}})
    this.resource = this.channel
    const stream = await this.channel.follow("stream")
    this.eventSource = new EventSource(stream?.uri || "NO URI FOR STREAM", {
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${this.clientToken}`,
          },
        }),
    })
    this.eventSource.addEventListener("Subscriptions Triggered", (me) => {
      this.sseMark = me.lastEventId
      this.sseSubscriptionsTriggered = me.data.split(",")
    })
  }


  @then("closes channel")
  public async closeChannel() {
    this.eventSource?.close()
  }


  @then("notification matches event id and subscription")
  public async notificationMatchesIdAndSelector() {
    // wait for notification to arrive
    await scheduler.wait(1000)
    assert.equal(this.lastEventId, this.sseMark)
    assert.ok(this.sseSubscriptionsTriggered.includes(this.subscriptionId || ""),
      `triggered list ${this.sseSubscriptionsTriggered} missing '${this.subscriptionId}'`)
  }
}
