import {DataTable} from "@cucumber/cucumber"
import assert from "assert"
import {binding, given, then} from "cucumber-tsflow"
import {Ketting, Link, Resource} from "ketting"
import {Workspace} from "./workspace"



const HOME_PROFILE = "https://level3.rest/profiles/home"


@binding([Workspace])
export class Fetch {

  private ketting: Ketting

  // @ts-ignore
  private resource: Resource


  public constructor(protected workspace: Workspace) {
    this.ketting = new Ketting(workspace.eventlyUrl)
  }


  async fetch() {
    return await this.resource.get()
  }


  @given("Client starts at root")
  public async getRoot() {
    this.resource = await this.ketting.go("/")
  }

  @given(/follows rel (.+)/)
  public async followRel(rel: string) {
    this.resource = await this.resource.follow(rel)
  }


  @then("content is HAL")
  public async isHal() {
    const state = await this.fetch()
    const {headers} = state
    const contentType = headers.get("content-type")
    assert(contentType?.includes("application/hal+json"), `Content-Type not HAL: ${contentType}`)
  }

  @then(/has L3 Home profile/)
  public async hasHomeProfile() {
    const state = await this.fetch()
    const {headers} = state
    const profiles = headers.get("profile")
    assert(profiles?.includes(HOME_PROFILE), `missing ${HOME_PROFILE} profile header.`)
    const allows = headers.get("allow")
    assert(allows?.includes("GET"), `allow header missing GET: ${allows}`)
    assert(allows?.includes("HEAD"), `allow header missing HEAD: ${allows}`)
  }

  @then(/has links/)
  public async hasLinks(data: DataTable) {
    const state = await this.fetch()
    const {links: actual} = state
    const expected: Link[] = data.hashes()
    for (const {rel, href, title} of expected) {
      const actualLink = actual.get(rel)
      assert(actualLink, `missing link ${rel}`)
      const {href: actualHref, title: actualTitle} = actualLink
      assert(href === actualHref, `expected href ${href}, actual: ${actualHref}`)
      if (title) {
        assert(title === actualTitle, `expected title ${title}, actual: ${actualTitle}`)
      }
    }
  }
}
